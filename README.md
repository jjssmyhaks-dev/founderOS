# Helm — AI Operating System for Solo Founders

> 26-agent system that runs your business: research, marketing, operations, finance.

## Architecture

```
                        ┌─────────────────────┐
                        │   Founder (Chat UI)  │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │  Global Orchestrator │
                        │  (LLM-based Router)  │
                        └──────────┬──────────┘
                                   │
              ┌────────────┬───────┴───────┬────────────┐
              │            │               │            │
     ┌────────▼───┐ ┌─────▼─────┐ ┌───────▼──────┐ ┌──▼─────────┐
     │  Research   │ │ Marketing  │ │  Operations  │ │  Finance   │
     │  (6 agents) │ │ (6 agents)│ │  (6 agents)  │ │ (3 agents) │
     └──────┬─────┘ └─────┬─────┘ └───────┬──────┘ └──┬─────────┘
            │              │               │            │
     ┌──────▼──────────────▼───────────────▼────────────▼─────┐
     │              Agent Runtime Harness                      │
     │  (execution loop, tool calling, risk gates, memory)     │
     └──────────────────────────┬────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
     ┌────────▼────────┐ ┌─────▼──────┐ ┌───────▼──────┐
     │  Event Bus      │ │  Memory    │ │  MCP Connectors│
     │  (Redis Pub/Sub)│ │  (pgvector)│ │  (15 external) │
     └─────────────────┘ └────────────┘ └──────────────┘
```

## Repository Structure

```
helm-ai-os/
├── backend/                  # NestJS API server
│   ├── prisma/
│   │   └── schema.prisma   # 18 tables (PostgreSQL + pgvector)
│   └── src/
│       ├── agents/          # Agent CRUD + 21-agent registry
│       ├── agent-runtime/   # Harness: 11 files (execution loop, tools, risk, memory)
│       ├── approvals/       # Tier 3 approval queue
│       ├── auth/            # JWT auth
│       ├── chat/            # Chat sessions + orchestrator routing
│       ├── common/          # Guards, decorators, filters
│       ├── connectors/      # 15 MCP connector definitions
│       ├── context/         # Context note CRUD
│       ├── events/          # Redis Pub/Sub event bus
│       ├── layers/          # 4 layer services (research/marketing/ops/finance)
│       ├── llm/             # Anthropic Claude wrapper
│       ├── memory/          # State & Memory: typed write/retrieve, conflict detection
│       ├── observability/   # Traces, spans, alerting, evals
│       ├── orchestration/   # Global orchestrator (LLM routing)
│       ├── prisma/          # Prisma module + service
│       └── tasks/           # Task CRUD
│
├── frontend/                 # Next.js 14 (App Router)
│   └── src/
│       ├── app/
│       │   ├── admin/       # Observability dashboard (6 tabs)
│       │   ├── observability/ # Founder-facing trace viewer
│       │   └── settings/    # Per-layer autonomy controls
│       ├── components/      # Chat UI, approvals, connectors, activity feed
│       ├── config/          # Agent/connector config data
│       ├── lib/             # Hooks
│       └── stores/          # Zustand stores (auth, chat, approvals, etc.)
│
├── ai/                      # Shared AI types & configs
│   └── src/
│       └── index.ts        # Enums, interfaces (TaskStatus, RiskTier, etc.)
│
├── docker-compose.yml       # Postgres + Redis + Backend + Frontend
├── .env.example             # Environment template
└── package.json             # npm workspaces root
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | NestJS 10, Prisma 5, PostgreSQL 16, Redis 7 |
| Frontend | Next.js 14, Tailwind CSS, Zustand, Lucide Icons |
| AI/Types | TypeScript shared enums & interfaces |
| LLM | Anthropic Claude (completions API) |
| Infra | Docker Compose |

## 21 Sub-Agents

| Layer | Agents |
|---|---|
| Research | Competitor Intelligence, Market Trends, Audience Insights, Product Research, Positioning, Research Synthesis |
| Marketing | Content Strategist, SEO Specialist, Social Media Manager, Performance Marketer, Brand Voice, Marketing Analytics |
| Operations | Vendor Manager, Project Coordinator, Customer Success, Workflow Automation, Logistics, Operations Analytics |
| Finance | Bookkeeper, Financial Analyst, Compliance Officer |

## 5 Orchestrators

- Global Orchestrator (LLM-based intent routing)
- Research Layer Orchestrator
- Marketing Layer Orchestrator
- Operations Layer Orchestrator
- Finance Layer Orchestrator

## Key Features

- **Agent Runtime Harness**: Execution loop with idempotency, consecutive failure escalation (3→fail), deadline enforcement, crash recovery, scheduled triggers
- **Risk Tiers**: AUTO_EXECUTE (Tier 1), NOTIFY_AND_ACT (Tier 2), APPROVAL_REQUIRED (Tier 3)
- **State & Memory**: 6 memory types, 3 confidence levels, LLM-based conflict detection, constraint→runtime-config bridge, supersede chains
- **Observability**: Traces, spans, alerting, agent leaderboard, eval harness, cost tracking
- **MCP Connectors**: 15 definitions (WhatsApp, Tally, GST, Razorpay, etc.)

## Quick Start

1. Clone and install:
```bash
git clone https://github.com/jjssmyhaks-dev/founderOS.git
cd founderOS
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, REDIS_URL, JWT_SECRET, ANTHROPIC_API_KEY
```

3. Setup database:
```bash
cd backend
npx prisma migrate dev
cd ..
```

4. Start services:
```bash
docker-compose up -d   # Postgres + Redis
npm run dev:backend     # http://localhost:3001
npm run dev:frontend    # http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Register founder |
| POST | /auth/login | Login, get JWT |
| POST | /chat/send | Send message to orchestrator |
| GET | /chat/sessions | List chat sessions |
| GET | /agents | List 21 agents + stats |
| GET/POST | /tasks | Task CRUD |
| GET/POST | /approvals | Approval queue |
| POST | /runtime/execute | Execute agent task |
| GET | /runtime/tasks/:id/steps | Task trace |
| GET | /runtime/stats | Agent performance |
| GET | /observability/traces | Query traces |
| GET | /observability/traces/:id | Trace detail + spans |
| GET | /observability/leaderboard | Agent leaderboard |
| POST | /observability/eval/:agentId | Run eval |
| POST | /memory/write | Write memory |
| POST | /memory/retrieve | Retrieve memory |
| GET | /memory/:founderId | List founder memories |

## License

MIT
