import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { EventService } from '../events/events.service';
import { WriteMemoryInput, RetrieveMemoryInput, MemoryType, Confidence, MemoryNote } from './types';
import { v4 as uuidv4 } from 'uuid';

const CONFIDENCE_RANK: Record<string, number> = { founder_stated: 3, confirmed: 2, inferred: 1 };
const SIMILARITY_THRESHOLD = 0.85;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private events: EventService,
  ) {}

  async writeMemory(input: WriteMemoryInput): Promise<MemoryNote> {
    const confidence = input.confidence || 'inferred';

    // Conflict detection: check for supersedeable existing memories
    const superseded = await this.findConflictingMemory(input);

    const embeddingId = await this.llm.generateEmbedding(input.content).catch(() => null);

    const note = await this.prisma.contextNote.create({
      data: {
        id: uuidv4(),
        founderId: input.founderId,
        layer: input.layer || null,
        category: input.memoryType,
        memoryType: input.memoryType,
        content: input.content,
        embeddingId,
        confidence,
        status: 'active',
        sourceAgentId: input.sourceAgentId || null,
        sourceTraceId: input.sourceTraceId || null,
        sourceTaskId: input.sourceTaskId || null,
        referenceCount: 0,
      },
    });

    // Supersede old conflicting memories
    if (superseded.length > 0) {
      for (const old of superseded) {
        // Only supersede if new confidence >= old confidence, or if same confidence but newer
        const oldRank = CONFIDENCE_RANK[old.confidence] || 0;
        const newRank = CONFIDENCE_RANK[confidence] || 0;
        if (newRank >= oldRank) {
          await this.prisma.contextNote.update({ where: { id: old.id }, data: { status: 'superseded', supersededBy: note.id } });
          this.logger.log('Superseded memory ' + old.id + ' -> ' + note.id);
        }
      }
    }

    // Constraint -> runtime config bridge (Section 7)
    if (input.memoryType === 'constraint') {
      await this.applyConstraintToConfig(input);
    }

    this.events.publish({
      type: 'system.memory.written',
      publisher: input.sourceAgentId || 'system',
      payload: { memoryId: note.id, memoryType: input.memoryType, confidence, founderId: input.founderId } as any,
    });

    this.logger.log('Memory written: ' + input.memoryType + ' [' + confidence + '] for ' + input.founderId);
    return note as unknown as MemoryNote;
  }

  async retrieveMemory(input: RetrieveMemoryInput): Promise<MemoryNote[]> {
    const maxResults = input.maxResults || 8;

    // 1. Always include strategic_goal and constraint for this founder (type-aware boosting)
    const alwaysInclude = await this.prisma.contextNote.findMany({
      where: { founderId: input.founderId, status: 'active', memoryType: { in: ['strategic_goal', 'constraint'] } },
      orderBy: [{ referenceCount: 'desc' }, { createdAt: 'desc' }],
    });

    // 2. Semantic similarity search (using LLM fallback since no real pgvector)
    const whereClause: any = { founderId: input.founderId, status: 'active' };
    if (input.layer) whereClause.layer = input.layer;
    if (input.memoryTypes && input.memoryTypes.length > 0) whereClause.memoryType = { in: input.memoryTypes };

    const candidates = await this.prisma.contextNote.findMany({
      where: whereClause,
      orderBy: [{ referenceCount: 'desc' }, { lastReferencedAt: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });

    // Filter out already-included strategic_goal/constraint
    const alwaysIds = new Set(alwaysInclude.map(n => n.id));
    const toRank = candidates.filter(n => !alwaysIds.has(n.id));

    // Rank by relevance to query using LLM
    let ranked: typeof toRank = [];
    if (toRank.length > 0 && input.query) {
      ranked = await this.rankByRelevance(input.query, toRank);
    } else {
      ranked = toRank;
    }

    const results = [...alwaysInclude, ...ranked].slice(0, maxResults);

    // Write-back: update lastReferencedAt and referenceCount
    const resultIds = results.map(n => n.id);
    if (resultIds.length > 0) {
      await this.prisma.contextNote.updateMany({
        where: { id: { in: resultIds } },
        data: { lastReferencedAt: new Date() },
      });
      // Increment referenceCount one by one (Prisma doesn't support increment on many with filter easily)
      for (const id of resultIds) {
        await this.prisma.contextNote.update({ where: { id }, data: { referenceCount: { increment: 1 } } });
      }
    }

    this.logger.verbose('Memory retrieval: ' + results.length + ' notes (' + alwaysInclude.length + ' boosted, ' + ranked.length + ' ranked)');
    return results as unknown as MemoryNote[];
  }

  async getMemories(founderId: string, filter?: { layer?: string; memoryType?: string; status?: string }) {
    const where: any = { founderId };
    if (filter?.layer) where.layer = filter.layer;
    if (filter?.memoryType) where.memoryType = filter.memoryType;
    if (filter?.status) where.status = filter.status;
    else where.status = 'active';
    return this.prisma.contextNote.findMany({ where, orderBy: [{ referenceCount: 'desc' }, { createdAt: 'desc' }] });
  }

  async getStaleCandidates(daysUnused: number = 30): Promise<MemoryNote[]> {
    const since = new Date(Date.now() - daysUnused * 86400000);
    const notes = await this.prisma.contextNote.findMany({
      where: { status: 'active', OR: [{ lastReferencedAt: { lt: since } }, { lastReferencedAt: null }], referenceCount: { lte: 2 }, createdAt: { lt: since } },
      orderBy: { lastReferencedAt: 'asc' },
      take: 50,
    });
    return notes as unknown as MemoryNote[];
  }

  private async findConflictingMemory(input: WriteMemoryInput) {
    const sameType = await this.prisma.contextNote.findMany({
      where: { founderId: input.founderId, memoryType: input.memoryType, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (sameType.length === 0) return [];

    // Use LLM to detect actual conflicts (semantic, not just same type)
    const conflictCheck = sameType.map(n => 'ID:' + n.id + ' CONTENT:' + n.content).join(String.fromCharCode(10));
    try {
      const result = await this.llm.classifyIntent(
        'Does this new memory CONFLICT with or SUPERSEDE any of these existing memories? Reply with the IDs of conflicting ones, comma-separated, or "none".'  + String.fromCharCode(10) + 'NEW: ' + input.content  + String.fromCharCode(10) + 'EXISTING:'  + String.fromCharCode(10) + conflictCheck,
        sameType.map(n => n.id),
      );
      const ids = result.metadata?.indices as number[] | undefined;
      if (ids && ids.length > 0) {
        return ids.filter(i => i < sameType.length).map(i => sameType[i]);
      }
    } catch (e) {
      this.logger.warn('Conflict detection LLM call failed, skipping');
    }
    return [];
  }

  private async applyConstraintToConfig(input: WriteMemoryInput): Promise<void> {
    // Parse structured constraints and apply to founder's autonomy settings
    const content = input.content.toLowerCase();
    const founder = await this.prisma.founder.findUnique({ where: { id: input.founderId } });
    if (!founder) return;

    const settings = (typeof founder.autonomySettings === 'object' ? founder.autonomySettings : {}) as Record<string, any>;

    // Spend limit pattern: "spend limit ... <number>"
    const spendMatch = content.match(/spend.{0,20}?limit.{0,20}?(\d[\d,]+)/);
    if (spendMatch) {
      const amount = parseInt(spendMatch[1].replace(/,/g, ''));
      if (!settings.spendLimits) settings.spendLimits = {};
      const layer = input.layer || 'global';
      settings.spendLimits[layer] = amount;
      this.logger.log('Applied spend limit constraint: ' + amount + ' for ' + layer);
    }

    // Blocked vendor pattern
    const vendorMatch = content.match(/block.{0,10}vendor.{0,30}?"([^"]+)"/);
    if (vendorMatch) {
      if (!settings.blockedVendors) settings.blockedVendors = [];
      settings.blockedVendors.push(vendorMatch[1]);
      this.logger.log('Added blocked vendor: ' + vendorMatch[1]);
    }

    await this.prisma.founder.update({ where: { id: input.founderId }, data: { autonomySettings: settings } });
  }

  private async rankByRelevance(query: string, candidates: any[]): Promise<any[]> {
    const notesText = candidates.map((n, i) => i + ': [' + n.memoryType + ' ' + (n.confidence || '') + '] ' + n.content).join(String.fromCharCode(10));
    try {
      const result = await this.llm.classifyIntent(
        'Rank these memory notes by relevance to the query. Return the indices of the most relevant ones, most relevant first.'  + String.fromCharCode(10) + 'QUERY: ' + query  + String.fromCharCode(10) + 'NOTES:'  + String.fromCharCode(10) + notesText,
        candidates.map((_, i) => String(i)),
      );
      const indices = result.metadata?.indices as number[] | undefined;
      if (indices && indices.length > 0) {
        return indices.filter(i => i < candidates.length).map(i => candidates[i]);
      }
    } catch (e) {
      this.logger.warn('Memory ranking LLM call failed, returning by reference count');
    }
    return candidates;
  }
}
