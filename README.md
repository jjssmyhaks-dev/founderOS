# Helm — AI Operating System for Solo Founders

> 26-agent system that runs your business: research, marketing, operations, finance.

Helm is an autonomous AI operating system designed for solo founders. It orchestrates 26 specialized agents across 4 business layers — Research, Marketing, Operations, and Finance — to handle the full spectrum of business tasks from competitor analysis to financial compliance.

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
│       ├── agents/          # Agent CRUD + 26-agent registry
│       ├── agent-runtime/   # Harness: execution loop, tools, risk, memory
│       ├── approvals/       # Tier 3 approval queue
│       ├── auth/            # JWT auth with bcrypt
│       ├── chat/            # Chat sessions + orchestrator routing
│       ├── common/          # Guards, decorators, filters, rate limiting
│       ├── connectors/      # 15 MCP connector definitions + health checks
│       ├── context/         # Context note CRUD
│       ├── events/          # Redis Pub/Sub event bus
│       ├── gateway/         # WebSocket gateway for real-time updates
│       ├── layers/          # 4 layer services (research/marketing/ops/finance)
│       ├── llm/             # Groq (free) + Anthropic fallback with retries
│       ├── memory/          # 6 memory types, 3 confidence levels, conflict detection
│       ├── observability/   # Traces, spans, alerting, leaderboard, evals, cost tracking
│       ├── orchestration/   # Global orchestrator (LLM routing)
│       ├── onboarding/      # Conversational 5-question founder setup
│       ├── prisma/          # Prisma module + service
│       └── tasks/           # Task CRUD
│
├── frontend/                 # Next.js 14 (App Router)
│   └── src/
│       ├── app/
│       │   ├── admin/       # Admin dashboard (6 tabs)
│       │   ├── login/       # Login page route
│       │   ├── observability/ # Founder-facing trace viewer
│       │   └── settings/    # Per-layer autonomy controls
│       ├── components/      # Chat UI, approvals, connectors, activity feed
│       ├── config/          # Agent/connector config data
│       ├── lib/             # API client, hooks
│       └── stores/          # Zustand stores (auth, chat, approvals, etc.)
│
├── ai/                      # Shared AI types & configs
│   └── src/
│       └── index.ts        # Enums, interfaces (TaskStatus, RiskTier, etc.)
│
├── docker-compose.yml       # Postgres + Redis
└── package.json             # npm workspaces root
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | NestJS 10, Prisma 5, PostgreSQL 16 + pgvector, Redis 7 |
| Frontend | Next.js 14, Tailwind CSS, Zustand, Lucide Icons |
| AI/Types | TypeScript shared enums & interfaces |
| LLM | Groq (free tier, primary) + Anthropic Claude (fallback) |
| Auth | JWT with bcrypt password hashing |
| Real-time | Socket.IO WebSocket gateway |
| Infra | Docker Compose |

## 26 Agents

| Layer | Agents |
|---|---|
| Research (6) | Competitor Intelligence, Market Trends, Audience Insights, Product Research, Positioning, Research Synthesis |
| Marketing (6) | Content Strategist, SEO Specialist, Social Media Manager, Performance Marketer, Brand Voice, Marketing Analytics |
| Operations (6) | Vendor Manager, Project Coordinator, Customer Success, Workflow Automation, Logistics, Operations Analytics |
| Finance (3) | Bookkeeper, Financial Analyst, Compliance Officer |

## 5 Orchestrators

- **Global Orchestrator** — LLM-based intent routing across all layers
- **Research Layer Orchestrator** — Routes within research agents
- **Marketing Layer Orchestrator** — Routes within marketing agents
- **Operations Layer Orchestrator** — Routes within operations agents
- **Finance Layer Orchestrator** — Routes within finance agents

## Key Features

### Agent Runtime Harness
- Execution loop with idempotency keys and crash recovery
- Consecutive failure escalation (3 failures → task fails)
- Deadline enforcement with automatic task timeout
- Scheduled trigger support for recurring tasks
- Tool calling framework with dynamic tool registration

### Risk Tiers
| Tier | Behavior | Examples |
|---|---|---|
| AUTO_EXECUTE (Tier 1) | Runs immediately | Research queries, internal analytics |
| NOTIFY_AND_ACT (Tier 2) | Runs + notifies founder | Content drafts, social posts |
| APPROVAL_REQUIRED (Tier 3) | Waits for founder approval | Financial transactions, external comms |

### State & Memory
- 6 memory types: TASK_OUTPUT, DECISION, CONTEXT, CONSTRAINT, USER_PREFERENCE, ERROR
- 3 confidence levels: HIGH, MEDIUM, LOW
- LLM-based conflict detection between new and existing memories
- Supersede chains for memory versioning
- Constraint → runtime-config bridge for dynamic agent behavior

### Observability
- Full trace/span hierarchy for every agent execution
- Alerting rules with configurable thresholds
- Agent performance leaderboard (task count, success rate, avg duration)
- Eval harness for agent quality measurement
- Cost tracking per task with token counting

### Onboarding
- Conversational 5-question setup flow
- Context extraction via LLM from founder responses
- First-action proposal and execution on completion
- State persisted to database across restarts

### MCP Connectors
- 15 connector definitions (WhatsApp, Tally, GST, Razorpay, etc.)
- Health check system with status tracking
- OAuth credential management
- Per-founder connector configuration

## Security

- **JWT authentication** with bcrypt password hashing
- **Founder-scoped data access** — all queries enforce founderId from JWT
- **Risk-gated execution** — tier 3 actions require explicit approval
- **Rate limiting** — configurable per-endpoint request throttling
- **Input validation** — class-validator pipes on all DTOs

## Quick Start

1. Clone and install:
```bash
git clone https://github.com/jjssmyhaks-dev/founderOS.git
cd founderOS
npm install
```

2. Configure environment:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL, REDIS_URL, JWT_SECRET,
# GROQ_API_KEY (primary), ANTHROPIC_API_KEY (optional fallback)
```

3. Setup database:
```bash
cd backend
npx prisma migrate dev
npx prisma db push
cd ..
```

4. Start services:
```bash
docker-compose up -d   # Postgres + Redis
npm run dev:backend     # http://localhost:3001
npm run dev:frontend    # http://localhost:3000
```

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Register founder account |
| POST | /auth/login | Login, get JWT token |

### Chat
| Method | Path | Description |
|---|---|---|
| POST | /chat/send | Send message to orchestrator |
| GET | /chat/sessions | List chat sessions |
| GET | /chat/sessions/:id/messages | Get session messages |

### Agents
| Method | Path | Description |
|---|---|---|
| GET | /agents | List 26 agents + stats |
| GET | /agents/:id | Get agent details |
| GET | /agents/:id/config | Get agent runtime config |

### Tasks
| Method | Path | Description |
|---|---|---|
| GET | /tasks | List tasks |
| POST | /tasks | Create task |
| GET | /tasks/:id | Get task details |
| PATCH | /tasks/:id | Update task |

### Approvals
| Method | Path | Description |
|---|---|---|
| GET | /approvals | Get pending approvals |
| POST | /approvals/:id/approve | Approve action |
| POST | /approvals/:id/reject | Reject action |

### Agent Runtime
| Method | Path | Description |
|---|---|---|
| POST | /runtime/execute | Execute agent task |
| GET | /runtime/tasks/:id/steps | Get task execution trace |
| GET | /runtime/stats | Agent performance stats |

### Observability
| Method | Path | Description |
|---|---|---|
| GET | /observability/traces | Query traces (founder-scoped) |
| GET | /observability/traces/:id | Trace detail + spans |
| GET | /observability/leaderboard | Agent leaderboard (founder-scoped) |
| POST | /observability/eval/:agentId | Run eval for agent |

### Memory
| Method | Path | Description |
|---|---|---|
| POST | /memory/write | Write memory with conflict detection |
| POST | /memory/retrieve | Retrieve relevant memories |
| GET | /memory/:founderId | List founder memories |

### Onboarding
| Method | Path | Description |
|---|---|---|
| POST | /onboarding/respond | Submit onboarding answer |
| GET | /onboarding/status | Check onboarding progress |
| POST | /onboarding/skip | Skip onboarding |

### Context
| Method | Path | Description |
|---|---|---|
| GET | /context | List context notes |
| POST | /context | Create context note |
| PATCH | /context/:id | Update context note |
| DELETE | /context/:id | Delete context note |

### Connectors
| Method | Path | Description |
|---|---|---|
| GET | /connectors | List available connectors |
| GET | /connectors/:id/status | Check connector health |
| POST | /connectors/:id/configure | Configure connector for founder |

### Activity
| Method | Path | Description |
|---|---|---|
| GET | /activity | Get activity feed |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string |
| JWT_SECRET | Yes | Secret key for JWT signing |
| GROQ_API_KEY | Yes | Groq API key (free tier, primary LLM) |
| ANTHROPIC_API_KEY | No | Anthropic API key (fallback LLM) |
| PORT | No | Backend port (default: 3001) |

### Frontend
| Variable | Required | Description |
|---|---|---|
| NEXT_PUBLIC_API_URL | Yes | Backend API URL (e.g., http://localhost:3001) |

## Development

```bash
# Install dependencies
npm install

# Run backend in dev mode
cd backend && npm run start:dev

# Run frontend in dev mode
cd frontend && npm run dev

# Run Prisma Studio (DB browser)
cd backend && npx prisma studio

# Generate Prisma client
cd backend && npx prisma generate

# Type check all packages
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
cd ai && npx tsc --noEmit
```

## License

MIT
