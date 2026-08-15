import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

export interface CreateContextNoteDto {
  founderId: string;
  category: string;
  content: string;
  sourceAgentId?: string;
  sourceTaskId?: string;
}

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async create(dto: CreateContextNoteDto) {
    const embeddingId = await this.llm.generateEmbedding(dto.content);
    return this.prisma.contextNote.create({
      data: {
        founderId: dto.founderId,
        category: dto.category,
        content: dto.content,
        embeddingId,
        sourceAgentId: dto.sourceAgentId || null,
        sourceTaskId: dto.sourceTaskId || null,
      },
    });
  }

  async findAll(founderId: string, category?: string) {
    const where: Record<string, unknown> = { founderId };
    if (category) where.category = category;
    return this.prisma.contextNote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, founderId: string) {
    return this.prisma.contextNote.findFirst({
      where: { id, founderId },
    });
  }

  async update(id: string, founderId: string, content: string) {
    return this.prisma.contextNote.update({
      where: { id, founderId },
      data: { content },
    });
  }

  async remove(id: string, founderId: string) {
    return this.prisma.contextNote.delete({
      where: { id, founderId },
    });
  }

  async queryContext(founderId: string, query: string, limit = 5) {
    const allNotes = await this.prisma.contextNote.findMany({
      where: { founderId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    if (allNotes.length === 0) return [];

    const notesText = allNotes
      .map((n) => `[${n.category}] ${n.content}`)
      .join('\n');

    const result = await this.llm.classifyIntent(
      `Find the most relevant context notes for this query: "${query}"\n\nAvailable notes:\n${notesText}`,
      allNotes.map((_: any, i: number) => `note_${i}`),
    );

    const selectedIndices = new Set<number>();
    const noteIds = result.metadata?.indices as number[] | undefined;
    if (Array.isArray(noteIds)) {
      noteIds.forEach((i: number) => selectedIndices.add(i));
    }

    if (selectedIndices.size === 0) {
      selectedIndices.add(0);
      if (allNotes.length > 1) selectedIndices.add(1);
    }

    const matched: typeof allNotes = [];
    for (const idx of selectedIndices) {
      if (idx < allNotes.length) {
        matched.push(allNotes[idx]);
        if (matched.length >= limit) break;
      }
    }

    this.logger.log(
      `Context query "${query}" returned ${matched.length} results`,
    );
    return matched;
  }
}
