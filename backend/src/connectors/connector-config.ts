// Connector endpoint configurations
// TODO: Replace placeholder URLs and tokens with real credentials

export interface ConnectorConfig {
  name: string;
  baseUrl: string;
  authType: string;
  authEnvKey: string;
  healthEndpoint: string;
  layer: string;
  description: string;
}

export const CONNECTOR_CONFIGS: Record<string, ConnectorConfig> = {
  'whatsapp': {
    name: 'WhatsApp Business',
    baseUrl: 'https://graph.facebook.com/v18.0',
    authType: 'BEARER',
    authEnvKey: 'WHATSAPP_ACCESS_TOKEN',
    healthEndpoint: '/me',
    layer: 'OPERATIONS',
    description: 'WhatsApp Business API for customer communication',
  },
  'tally': {
    name: 'Tally',
    baseUrl: 'https://api.tally.so',
    authType: 'BEARER',
    authEnvKey: 'TALLY_API_KEY',
    healthEndpoint: '/forms',
    layer: 'OPERATIONS',
    description: 'Tally ERP for accounting and GST compliance',
  },
  'gst': {
    name: 'GST Portal',
    baseUrl: 'https://gstapi.onlinesmsgst.com',
    authType: 'API_KEY',
    authEnvKey: 'GST_API_KEY',
    healthEndpoint: '/api/gst/status',
    layer: 'FINANCE',
    description: 'GST filing and compliance portal',
  },
  'razorpay': {
    name: 'Razorpay',
    baseUrl: 'https://api.razorpay.com/v1',
    authType: 'BASIC',
    authEnvKey: 'RAZORPAY_KEY_SECRET',
    healthEndpoint: '/payments',
    layer: 'FINANCE',
    description: 'Payment processing and subscription management',
  },
  'google-ads': {
    name: 'Google Ads',
    baseUrl: 'https://googleads.googleapis.com/v16',
    authType: 'OAUTH',
    authEnvKey: 'GOOGLE_ADS_OAUTH_TOKEN',
    healthEndpoint: '/customers/me',
    layer: 'MARKETING',
    description: 'Google Ads campaign management',
  },
  'meta-ads': {
    name: 'Meta Ads',
    baseUrl: 'https://graph.facebook.com/v18.0',
    authType: 'BEARER',
    authEnvKey: 'META_ADS_ACCESS_TOKEN',
    healthEndpoint: '/me/adaccounts',
    layer: 'MARKETING',
    description: 'Meta (Facebook/Instagram) ad management',
  },
  'google-analytics': {
    name: 'Google Analytics',
    baseUrl: 'https://analyticsdata.googleapis.com/v1beta',
    authType: 'OAUTH',
    authEnvKey: 'GA_OAUTH_TOKEN',
    healthEndpoint: '/properties',
    layer: 'MARKETING',
    description: 'Website analytics and user behavior tracking',
  },
  'slack': {
    name: 'Slack',
    baseUrl: 'https://slack.com/api',
    authType: 'BEARER',
    authEnvKey: 'SLACK_BOT_TOKEN',
    healthEndpoint: '/auth.test',
    layer: 'CROSS_LAYER',
    description: 'Internal team communication and alerts',
  },
  'calendly': {
    name: 'Calendly',
    baseUrl: 'https://api.calendly.com',
    authType: 'BEARER',
    authEnvKey: 'CALENDLY_TOKEN',
    healthEndpoint: '/users/me',
    layer: 'OPERATIONS',
    description: 'Scheduling and calendar management',
  },
  'notion': {
    name: 'Notion',
    baseUrl: 'https://api.notion.com/v1',
    authType: 'BEARER',
    authEnvKey: 'NOTION_TOKEN',
    healthEndpoint: '/users/me',
    layer: 'CROSS_LAYER',
    description: 'Knowledge base and documentation',
  },
  'shopify': {
    name: 'Shopify',
    baseUrl: 'https://<STORE>.myshopify.com/admin/api/2024-01',
    authType: 'BEARER',
    authEnvKey: 'SHOPIFY_ACCESS_TOKEN',
    healthEndpoint: '/shop.json',
    layer: 'OPERATIONS',
    description: 'E-commerce platform management',
  },
  'intercom': {
    name: 'Intercom',
    baseUrl: 'https://api.intercom.io',
    authType: 'BEARER',
    authEnvKey: 'INTERCOM_TOKEN',
    healthEndpoint: '/admins',
    layer: 'OPERATIONS',
    description: 'Customer support and engagement platform',
  },
  'x-twitter': {
    name: 'X (Twitter)',
    baseUrl: 'https://api.twitter.com/2',
    authType: 'OAUTH',
    authEnvKey: 'TWITTER_OAUTH_TOKEN',
    healthEndpoint: '/users/me',
    layer: 'MARKETING',
    description: 'Social media posting and monitoring',
  },
  'mailchimp': {
    name: 'Mailchimp',
    baseUrl: 'https://<DC>.api.mailchimp.com/3.0',
    authType: 'BASIC',
    authEnvKey: 'MAILCHIMP_KEY',
    healthEndpoint: '/lists',
    layer: 'MARKETING',
    description: 'Email marketing and automation',
  },
  'openai': {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    authType: 'BEARER',
    authEnvKey: 'OPENAI_API_KEY',
    healthEndpoint: '/models',
    layer: 'CROSS_LAYER',
    description: 'Embeddings and additional AI capabilities',
  },
};

export function getConnectorConfig(name: string): ConnectorConfig | null {
  return CONNECTOR_CONFIGS[name] || null;
}
