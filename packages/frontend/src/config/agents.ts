export const LAYERS = {
  RESEARCH: { name: 'Research', color: '#3b82f6', bgClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  MARKETING: { name: 'Marketing', color: '#a855f7', bgClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  OPERATIONS: { name: 'Operations', color: '#f59e0b', bgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  FINANCE: { name: 'Finance', color: '#22c55e', bgClass: 'bg-green-500/10 text-green-400 border-green-500/20' },
  GLOBAL: { name: 'Orchestrator', color: '#6366f1', bgClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
} as const;

export type LayerKey = keyof typeof LAYERS;

export interface AgentDef {
  id: string;
  name: string;
  layer: LayerKey;
  responsibility: string;
  emoji: string;
}

export const AGENTS: AgentDef[] = [
  // Research
  { id: 'competitor-intelligence', name: 'Competitor Intel', layer: 'RESEARCH', responsibility: 'Tracks competitors — pricing, launches, positioning shifts', emoji: '🔍' },
  { id: 'market-trend-scanning', name: 'Market Trends', layer: 'RESEARCH', responsibility: 'Continuous industry news and category shift monitoring', emoji: '📈' },
  { id: 'pricing-benchmarking', name: 'Pricing Bench', layer: 'RESEARCH', responsibility: 'Live category pricing benchmarking', emoji: '💰' },
  { id: 'customer-audience-research', name: 'Audience Research', layer: 'RESEARCH', responsibility: 'Persona research, review mining, sentiment analysis', emoji: '👥' },
  { id: 'campaign-deep-dive', name: 'Campaign Research', layer: 'RESEARCH', responsibility: 'On-demand deep research for specific angles', emoji: '🔬' },
  // Marketing
  { id: 'digital-marketing-strategist', name: 'Marketing Strategy', layer: 'MARKETING', responsibility: 'Channel strategy and campaign planning', emoji: '📋' },
  { id: 'performance-marketer', name: 'Performance Ads', layer: 'MARKETING', responsibility: 'Paid ads management, conversion tracking, budget pacing', emoji: '📊' },
  { id: 'content-copywriter', name: 'Content & Copy', layer: 'MARKETING', responsibility: 'Blog, email, ad copy, landing page content', emoji: '✍️' },
  { id: 'seo-specialist', name: 'SEO Specialist', layer: 'MARKETING', responsibility: 'Keyword research, on-page SEO, content gaps', emoji: '🏷️' },
  { id: 'designer', name: 'Designer', layer: 'MARKETING', responsibility: 'Creative assets via Figma/Canva connectors', emoji: '🎨' },
  { id: 'social-community', name: 'Social & Community', layer: 'MARKETING', responsibility: 'Organic social posting and community engagement', emoji: '💬' },
  // Operations
  { id: 'process-workflow', name: 'Process & Workflow', layer: 'OPERATIONS', responsibility: 'SOPs, task automation, workflow bottleneck detection', emoji: '⚙️' },
  { id: 'vendor-supply-chain', name: 'Vendor & Supply', layer: 'OPERATIONS', responsibility: 'Vendor communication, order tracking, delay detection', emoji: '📦' },
  { id: 'quality-fulfillment', name: 'Quality & Fulfill', layer: 'OPERATIONS', responsibility: 'Quality checks, fulfillment tracking', emoji: '✅' },
  { id: 'customer-support', name: 'Customer Support', layer: 'OPERATIONS', responsibility: 'Tier-1 support triage, FAQ handling, escalation', emoji: '🎧' },
  { id: 'scheduling-capacity', name: 'Capacity Planning', layer: 'OPERATIONS', responsibility: 'Resource forecasting, scheduling conflicts', emoji: '📅' },
  // Finance
  { id: 'bookkeeping', name: 'Bookkeeping', layer: 'FINANCE', responsibility: 'Transaction categorization, reconciliation', emoji: '📒' },
  { id: 'cashflow-forecasting', name: 'Cashflow Forecast', layer: 'FINANCE', responsibility: 'Real-time cash position and runway forecasting', emoji: '💹' },
  { id: 'pricing-unit-economics', name: 'Unit Economics', layer: 'FINANCE', responsibility: 'Margin analysis, pricing recommendations', emoji: '📐' },
  { id: 'compliance-tax', name: 'Compliance & Tax', layer: 'FINANCE', responsibility: 'Filing calendar, GST/tax obligation tracking', emoji: '🏛️' },
  { id: 'fundraising-ir', name: 'Fundraising & IR', layer: 'FINANCE', responsibility: 'Cap table hygiene, investor update drafting', emoji: '🤝' },
  // Orchestrators
  { id: 'research-orchestrator', name: 'Research Lead', layer: 'RESEARCH', responsibility: 'Research layer coordinator', emoji: '🧠' },
  { id: 'marketing-orchestrator', name: 'Marketing Lead', layer: 'MARKETING', responsibility: 'Marketing layer coordinator', emoji: '🧠' },
  { id: 'operations-orchestrator', name: 'Ops Lead', layer: 'OPERATIONS', responsibility: 'Operations layer coordinator', emoji: '🧠' },
  { id: 'finance-orchestrator', name: 'Finance Lead', layer: 'FINANCE', responsibility: 'Finance layer coordinator', emoji: '🧠' },
  { id: 'global-orchestrator', name: 'Helm', layer: 'GLOBAL', responsibility: 'Global orchestrator — routes, coordinates, oversees', emoji: '⭐' },
];

export function getLayerConfig(layer: string) {
  return LAYERS[layer as LayerKey] || LAYERS.GLOBAL;
}
