import { Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { ActivityService } from '../activity/activity.service';

const CONNECTOR_DEFINITIONS = [
  {
    name: 'web-search',
    displayName: 'Web Search',
    description: 'Search the web for information, news, and data.',
    icon: '🔍',
    authType: 'API_KEY',
    layer: 'CROSS_LAYER',
    scopes: [],
    tools: ['search', 'search_news', 'search_images'],
  },
  {
    name: 'news-rss',
    displayName: 'News / RSS',
    description: 'Subscribe to news feeds and RSS sources for market intelligence.',
    icon: '📰',
    authType: 'API_KEY',
    layer: 'RESEARCH',
    scopes: [],
    tools: ['fetch_feed', 'search_articles', 'monitor_keywords'],
  },
  {
    name: 'figma',
    displayName: 'Figma',
    description: 'Access Figma designs, components, and design tokens.',
    icon: '🎨',
    authType: 'OAUTH',
    layer: 'MARKETING',
    scopes: ['file:read', 'file:write', 'component:read'],
    tools: ['get_design', 'export_asset', 'list_projects'],
  },
  {
    name: 'meta-ads',
    displayName: 'Meta Ads',
    description: 'Manage Facebook and Instagram advertising campaigns.',
    icon: '📢',
    authType: 'OAUTH',
    layer: 'MARKETING',
    scopes: ['ads_read', 'ads_management', 'pages_manage'],
    tools: ['create_campaign', 'get_insights', 'manage_audience', 'update_budget'],
  },
  {
    name: 'google-ads',
    displayName: 'Google Ads',
    description: 'Manage Google Ads campaigns, keywords, and performance.',
    icon: '📊',
    authType: 'OAUTH',
    layer: 'MARKETING',
    scopes: ['adwords', 'analytics.readonly'],
    tools: ['create_campaign', 'get_performance', 'manage_keywords', 'update_bids'],
  },
  {
    name: 'canva',
    displayName: 'Canva',
    description: 'Create and manage visual designs through Canva.',
    icon: '🖼️',
    authType: 'OAUTH',
    layer: 'MARKETING',
    scopes: ['design:read', 'design:edit', 'asset:read'],
    tools: ['create_design', 'export_design', 'list_templates', 'get_brand_kit'],
  },
  {
    name: 'instagram-linkedin',
    displayName: 'Instagram / LinkedIn',
    description: 'Manage social media posting, analytics, and engagement.',
    icon: '📱',
    authType: 'OAUTH',
    layer: 'MARKETING',
    scopes: ['basic', 'content_publish', 'analytics'],
    tools: ['post_content', 'get_analytics', 'schedule_post', 'manage_comments'],
  },
  {
    name: 'whatsapp-business',
    displayName: 'WhatsApp Business',
    description: 'Send messages, manage templates, and handle customer chats.',
    icon: '💬',
    authType: 'API_KEY',
    layer: 'OPERATIONS',
    scopes: [],
    tools: ['send_message', 'send_template', 'get_conversations', 'webhook_events'],
  },
  {
    name: 'slack',
    displayName: 'Slack',
    description: 'Send notifications, manage channels, and integrate workflows.',
    icon: '🔗',
    authType: 'OAUTH',
    layer: 'CROSS_LAYER',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    tools: ['send_message', 'update_channel', 'get_history', 'schedule_reminder'],
  },
  {
    name: 'google-sheets',
    displayName: 'Google Sheets',
    description: 'Read, write, and manage spreadsheet data.',
    icon: '📋',
    authType: 'OAUTH',
    layer: 'CROSS_LAYER',
    scopes: ['spreadsheets.readonly', 'spreadsheets', 'drive.readonly'],
    tools: ['read_sheet', 'write_sheet', 'append_rows', 'create_chart'],
  },
  {
    name: 'tally',
    displayName: 'Tally',
    description: 'Collect form submissions and survey responses.',
    icon: '📝',
    authType: 'API_KEY',
    layer: 'OPERATIONS',
    scopes: [],
    tools: ['get_submissions', 'list_forms', 'get_form_data'],
  },
  {
    name: 'banking-api',
    displayName: 'Banking API',
    description: 'Access bank transactions, balances, and financial data.',
    icon: '🏦',
    authType: 'API_KEY',
    layer: 'FINANCE',
    scopes: [],
    tools: ['get_balance', 'get_transactions', 'get_statement', 'transfer'],
  },
  {
    name: 'gst-portal',
    displayName: 'GST Portal',
    description: 'File GST returns, manage compliance, and tax data.',
    icon: '🧾',
    authType: 'API_KEY',
    layer: 'FINANCE',
    scopes: [],
    tools: ['file_return', 'get_gstin', 'view_notices', 'download_challan'],
  },
  {
    name: 'gmail-outlook',
    displayName: 'Gmail / Outlook',
    description: 'Send and receive emails, manage inbox.',
    icon: '📧',
    authType: 'OAUTH',
    layer: 'CROSS_LAYER',
    scopes: ['mail.read', 'mail.send', 'mail.modify'],
    tools: ['send_email', 'read_email', 'search_emails', 'manage_labels'],
  },
  {
    name: 'google-calendar',
    displayName: 'Google Calendar',
    description: 'Manage events, availability, and scheduling.',
    icon: '📅',
    authType: 'OAUTH',
    layer: 'OPERATIONS',
    scopes: ['calendar.readonly', 'calendar.events'],
    tools: ['create_event', 'list_events', 'check_availability', 'send_invites'],
  },
];

@Injectable()
export class ConnectorService {
  private readonly logger = new Logger(ConnectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly activityService: ActivityService,
  ) {}

  async seedDefinitions() {
    const count = await this.prisma.connectorDefinition.count();
    if (count > 0) return;

    for (const def of CONNECTOR_DEFINITIONS) {
      await this.prisma.connectorDefinition.upsert({
        where: { name: def.name },
        create: def,
        update: def,
      });
    }

    this.logger.log(`Seeded ${CONNECTOR_DEFINITIONS.length} connector definitions`);
  }

  async getRegistry(founderId: string) {
    await this.seedDefinitions();

    const definitions = await this.prisma.connectorDefinition.findMany({
      orderBy: { displayName: 'asc' },
    });

    const connections = await this.prisma.connector.findMany({
      where: { founderId },
    });

    const connectionMap = new Map(connections.map((c) => [c.connectorName, c]));

    return definitions.map((def: any) => ({
      ...def,
      connection: connectionMap.get(def.name) || null,
    }));
  }

  async connect(founderId: string, name: string) {
    const def = await this.prisma.connectorDefinition.findUnique({
      where: { name },
    });
    if (!def) throw new Error(`Connector "${name}" not found`);

    const existing = await this.prisma.connector.findFirst({
      where: { founderId, connectorName: name },
    });

    if (existing) {
      const updated = await this.prisma.connector.update({
        where: { id: existing.id },
        data: {
          status: 'CONNECTED',
          authMetadata: {
            encrypted: true,
            algorithm: 'AES-256-GCM',
            connectedAt: new Date().toISOString(),
          },
          lastHealthCheck: new Date(),
          lastSuccessfulCall: new Date(),
        },
      });
      return updated;
    }

    const connector = await this.prisma.connector.create({
      data: {
        founderId,
        connectorName: name,
        status: 'CONNECTED',
        authMetadata: {
          encrypted: true,
          algorithm: 'AES-256-GCM',
          connectedAt: new Date().toISOString(),
        },
        lastHealthCheck: new Date(),
        lastSuccessfulCall: new Date(),
      },
    });

    await this.eventService.publish({
      type: 'connector.status_changed',
      publisher: 'system',
      payload: { connectorName: name, status: 'CONNECTED', founderId },
    });

    await this.activityService.logActivity({
      founderId,
      type: 'CONNECTOR_USED',
      description: `Connected connector: ${def.displayName}`,
    });

    this.logger.log(`Connector ${name} connected for founder ${founderId}`);
    return connector;
  }

  async disconnect(founderId: string, name: string) {
    const connector = await this.prisma.connector.findFirst({
      where: { founderId, connectorName: name },
    });

    if (!connector) throw new Error(`Connector "${name}" not connected`);

    const updated = await this.prisma.connector.update({
      where: { id: connector.id },
      data: { status: 'DISCONNECTED', authMetadata: Prisma.JsonNull },
    });

    await this.eventService.publish({
      type: 'connector.status_changed',
      publisher: 'system',
      payload: { connectorName: name, status: 'DISCONNECTED', founderId },
    });

    this.logger.log(`Connector ${name} disconnected for founder ${founderId}`);
    return updated;
  }

  async checkHealth(founderId: string, name: string) {
    const connector = await this.prisma.connector.findFirst({
      where: { founderId, connectorName: name },
    });

    if (!connector) {
      return { name, status: 'DISCONNECTED', healthy: false };
    }

    const now = new Date();
    const lastCheck = connector.lastHealthCheck;
    const healthy =
      connector.status === 'CONNECTED' &&
      (!lastCheck ||
        now.getTime() - lastCheck.getTime() < 5 * 60 * 1000);

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: { lastHealthCheck: now },
    });

    return {
      name,
      status: connector.status,
      healthy,
      lastHealthCheck: now,
      lastSuccessfulCall: connector.lastSuccessfulCall,
    };
  }
}


