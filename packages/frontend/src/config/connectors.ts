export interface ConnectorDef {
  name: string;
  displayName: string;
  icon: string;
  layer: string;
  description: string;
}

export const CONNECTOR_DEFS: ConnectorDef[] = [
  // Research
  { name: 'web-search', displayName: 'Web Search', icon: '🌐', layer: 'RESEARCH', description: 'Market and competitor scanning' },
  { name: 'news-rss', displayName: 'News / RSS', icon: '📰', layer: 'RESEARCH', description: 'Trend monitoring feeds' },
  // Marketing
  { name: 'figma', displayName: 'Figma', icon: '🎨', layer: 'MARKETING', description: 'Design asset access' },
  { name: 'meta-ads', displayName: 'Meta Ads', icon: '📱', layer: 'MARKETING', description: 'Facebook & Instagram campaign management' },
  { name: 'google-ads', displayName: 'Google Ads', icon: '🔍', layer: 'MARKETING', description: 'Search and display ad campaigns' },
  { name: 'canva', displayName: 'Canva', icon: '🖼️', layer: 'MARKETING', description: 'Creative generation' },
  { name: 'instagram-linkedin', displayName: 'Instagram / LinkedIn', icon: '📸', layer: 'MARKETING', description: 'Social posting and engagement' },
  // Operations
  { name: 'whatsapp-business', displayName: 'WhatsApp Business', icon: '💬', layer: 'OPERATIONS', description: 'Customer and vendor communication' },
  { name: 'slack', displayName: 'Slack', icon: '🔔', layer: 'OPERATIONS', description: 'Internal notifications' },
  { name: 'google-sheets', displayName: 'Google Sheets', icon: '📊', layer: 'OPERATIONS', description: 'Inventory and tracking' },
  // Finance
  { name: 'tally', displayName: 'Tally', icon: '📒', layer: 'FINANCE', description: 'Bookkeeping sync (India SMB standard)' },
  { name: 'banking-api', displayName: 'Banking API', icon: '🏦', layer: 'FINANCE', description: 'Transaction feed and payments' },
  { name: 'gst-portal', displayName: 'GST Portal', icon: '🏛️', layer: 'FINANCE', description: 'Compliance filing status' },
  // Cross-layer
  { name: 'gmail-outlook', displayName: 'Gmail / Outlook', icon: '📧', layer: 'CROSS_LAYER', description: 'Email drafting and sending' },
  { name: 'google-calendar', displayName: 'Google Calendar', icon: '📅', layer: 'CROSS_LAYER', description: 'Scheduling' },
];
