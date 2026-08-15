# Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`
   - Anon Key → `SUPABASE_ANON_KEY`

## 2. Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Create a new API key → `ANTHROPIC_API_KEY`

## 3. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values
```

## 4. Setup Database

Option A: **Supabase Managed (recommended)**
```bash
# Push schema to your Supabase project
cd backend
npx prisma db push
```

Option B: **Local Supabase**
```bash
# Install Supabase CLI
npm i -g supabase

# Start local Supabase stack
supabase start

# This gives you a local Postgres + Auth + Realtime
# Update .env with the local URLs shown by supabase start

# Push schema
npx prisma db push
```

## 5. Install Dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## 6. Start Development

```bash
# Terminal 1: Redis (if not using Docker)
redis-server

# Terminal 2: Backend
cd backend
npm run start:dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

Open http://localhost:3000

## 7. Connector Setup (Optional)

Add connector API keys to `.env` as you need them. Each connector has a
`CONNECTOR_CONFIGS` entry in `backend/src/connectors/connector-config.ts`
that specifies which env var to read.

### Quick Start Connectors

| Connector | What you need | Setup time |
|---|---|---|
| Razorpay | Key ID + Secret | 5 min |
| Slack | Bot token | 5 min |
| Notion | Integration token | 2 min |
| Calendly | Personal access token | 2 min |
| OpenAI | API key (for embeddings) | 2 min |

### Advanced Connectors

| Connector | What you need | Setup time |
|---|---|---|
| WhatsApp Business | Meta Developer App + Access Token | 30 min |
| Google Ads | OAuth + Developer token | 30 min |
| Meta Ads | Business Manager + Access Token | 20 min |
| Google Analytics | OAuth + Property access | 15 min |
| Tally | API key from Tally | 10 min |
| GST Portal | API credentials | 20 min |
| Shopify | Private app + Access token | 15 min |
| Intercom | Access token | 10 min |
| X/Twitter | Developer account + OAuth | 20 min |
| Mailchimp | API key | 5 min |
