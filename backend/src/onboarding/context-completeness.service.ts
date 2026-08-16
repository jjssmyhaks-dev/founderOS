import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LayerCompleteness {
  layer: string;
  totalNotes: number;
  businessFacts: number;
  strategicGoals: number;
  constraints: number;
  otherNotes: number;
  score: number;
}

@Injectable()
export class ContextCompletenessService {
  constructor(private prisma: PrismaService) {}

  async getCompleteness(founderId: string): Promise<LayerCompleteness[]> {
    const layers = ['research', 'marketing', 'operations', 'finance', 'global'];
    const results: LayerCompleteness[] = [];

    for (const layer of layers) {
      const whereClause: any = { founderId, status: 'active' };
      if (layer !== 'global') whereClause.layer = layer;

      const notes = await this.prisma.contextNote.findMany({
        where: whereClause,
        select: { memoryType: true },
      });

      const total = notes.length;
      const businessFacts = notes.filter(n => n.memoryType === 'business_fact').length;
      const strategicGoals = notes.filter(n => n.memoryType === 'strategic_goal').length;
      const constraints = notes.filter(n => n.memoryType === 'constraint').length;
      const other = total - businessFacts - strategicGoals - constraints;

      // Simple score: having at least 1 business_fact = 40%, 1 goal = 30%, 1+ other = 30%
      let score = 0;
      if (businessFacts > 0) score += 40;
      if (businessFacts >= 3) score += 10;
      if (strategicGoals > 0) score += 30;
      if (constraints > 0) score += 10;
      if (other > 0) score += 10;

      results.push({
        layer: layer === 'global' ? 'Global' : layer.charAt(0).toUpperCase() + layer.slice(1),
        totalNotes: total,
        businessFacts,
        strategicGoals,
        constraints,
        otherNotes: other,
        score: Math.min(score, 100),
      });
    }

    return results;
  }

  async getOverallScore(founderId: string): Promise<number> {
    const layers = await this.getCompleteness(founderId);
    if (layers.length === 0) return 0;
    return Math.round(layers.reduce((sum, l) => sum + l.score, 0) / layers.length);
  }

  async shouldPromptContext(founderId: string, layer?: string): Promise<boolean> {
    const layers = await this.getCompleteness(founderId);
    const target = layers.find(l => l.layer.toLowerCase() === (layer || '')) || layers[0];
    return target ? target.score < 50 : true;
  }
}
