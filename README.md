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
     │  (guardrails, evals, self-improvement, concurrency)     │
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
│   │   ├── schema.prisma   # 23 tables (PostgreSQL + pgvector)
│   │   └── init.sql        # Database initialization
│   └── src/
│       ├── agents/          # Agent CRUD + 26-agent registry + prompts
│       ├── agent-runtime/   # Harness: execution loop, tools, risk, memory
│       │   ├── agentic-harness.service.ts    # Lifecycle, concurrency, priority queue
│       │   ├── self-improvement.service.ts   # Feedback loops, performance tuning
│       │   ├── tool-registry.service.ts      # 16 functional tools
│       │   ├── handoff.service.ts            # Event → task trigger
│       │   ├── risk-gate.service.ts          # Autonomy settings, spend limits
│       │   ├── crash-recovery.service.ts     # Failure escalation
│       │   ├── context-assembler.service.ts  # Token-budgeted context
│       │   ├── mcp-connector-executor.service.ts # MCP HTTP execution
│       │   └── scheduled-trigger.service.ts  # Recurring task support
│       ├── approvals/       # Tier 3 approval queue
│       ├── auth/            # JWT auth with bcrypt
│       ├── chat/            # Chat sessions + orchestrator routing
│       ├── common/          # Guards, decorators, filters, rate limiting
│       ├── connectors/      # 15 MCP connector definitions + health checks
│       ├── context/         # Context note CRUD
│       ├── events/          # Redis Pub/Sub event bus
│       ├── gateway/         # WebSocket gateway for real-time updates
│       ├── guardrails/      # Prompt injection, PII redaction, budget caps
│       ├── health/          # Health check endpoints
│       ├── layers/          # 4 layer services (research/marketing/ops/finance)
│       ├── llm/             # Groq (primary) + Anthropic fallback with retries
│       ├── memory/          # 6 memory types, conflict detection, consolidation
│       ├── observability/   # Traces, spans, alerting, leaderboard, evals
│       ├── orchestration/   # Global orchestrator (LLM routing + decomposition)
│       ├── onboarding/      # Conversational 5-question founder setup
│       ├── prisma/          # Prisma module + service
│       ├── scheduler/       # Scheduled task execution
│       └── tasks/           # Task CRUD
│
├── frontend/                 # Next.js 14 (App Router)
│   └── src/
│       ├── app/
│       │   ├── page.tsx     # Feedly-inspired landing page
│       │   ├── admin/       # Admin dashboard (6 tabs)
│       │   ├── login/       # Login page
│       │   ├── observability/ # Founder-facing trace viewer
│       │   └── settings/    # Per-layer autonomy controls
│       ├── components/      # Chat UI, approvals, connectors, activity feed
│       │   ├── ChatPane.tsx # Chat with voice input (Web Speech API)
│       │   └── Login.tsx    # Themed login component
│       ├── config/          # Agent/connector config data
│       ├── lib/             # API client, hooks
│       └── stores/          # Zustand stores (auth, chat, approvals, etc.)
│
├── ai/                      # Shared AI types & configs
│   └── src/
│       └── index.ts        # Enums, interfaces (TaskStatus, RiskTier, etc.)
│
├── docker-compose.yml       # Postgres + Redis (production-ready)
├── DEPLOYMENT.md            # Production deployment guide
└── package.json             # npm workspaces root
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | NestJS 10, Prisma 5, PostgreSQL 16 + pgvector, Redis 7 |
| Frontend | Next.js 14, Tailwind CSS, Zustand, Lucide Icons, Framer Motion |
| AI/Types | TypeScript shared enums & interfaces |
| LLM | Groq (free tier, primary) + Anthropic Claude (fallback) |
| Auth | JWT with bcrypt password hashing |
| Real-time | Socket.IO WebSocket gateway |
| Infra | Docker Compose, production deployment ready |

## 26 Agents

| Layer | Agents |
|---|---|
| Research (6) | Competitor Intelligence, Market Trends, Audience Insights, Product Research, Positioning, Research Synthesis |
| Marketing (6) | Content Strategist, SEO Specialist, Social Media Manager, Performance Marketer, Brand Voice, Marketing Analytics |
| Operations (6) | Vendor Manager, Project Coordinator, Customer Success, Workflow Automation, Logistics, Operations Analytics |
| Finance (3) | Bookkeeper, Financial Analyst, Compliance Officer |

## 5 Orchestrators

- **Global Orchestrator** — LLM-based intent routing + task decomposition across all layers
- **Research Layer Orchestrator** — Routes within research agents
- **Marketing Layer Orchestrator** — Routes within marketing agents
- **Operations Layer Orchestrator** — Routes within operations agents
- **Finance Layer Orchestrator** — Routes within finance agents

## Key Features

### 16 Functional Tools

| Tool | Risk Tier | Description |
|---|---|---|
| `query_context` | AUTO | Query the founder's business knowledge base |
| `write_memory` | AUTO | Save findings, decisions, insights for future reference |
| `web_search` | AUTO | Search the internet for current data |
| `analyze_data` | AUTO | LLM-powered analysis on structured data |
| `read_activity_log` | AUTO | Read what other agents have been doing |
| `get_task_status` | AUTO | Check task status across the system |
| `read_documents` | AUTO | Search the founder's document store |
| `notify_founder` | AUTO | Push urgent notifications with urgency levels |
| `publish_event` | AUTO | Signal cross-layer events to trigger other agents |
| `request_approval` | APPROVAL | Ask founder before high-risk actions |
| `decompose_task` | NOTIFY | Break complex goals into subtasks |
| `delegate_to_agent` | NOTIFY | Hand off work to a specialist agent |
| `create_social_post` | APPROVAL | Draft platform-specific social content |
| `send_email` | APPROVAL | Send emails via connected service |
| `schedule_action` | APPROVAL | Schedule future or recurring task execution |
| `create_task` | AUTO | Create a new task in the system |

### Agent Runtime Harness

- **Execution loop** with idempotency keys, crash recovery, and deadline enforcement
- **Concurrency control** — max 10 global, max 2 per agent (configurable)
- **Priority queue** — tasks sorted by priority + time
- **Graceful degradation** — fails queued tasks when system stressed
- **Post-execution pipeline** — output guardrails → budget recording → auto-eval → self-improvement
- **Event-driven activation** — Redis events trigger tasks automatically

### Guardrails & Security

| Guardrail | Description |
|---|---|
| Prompt injection detection | 15+ patterns: DAN, role hijacking, system prompt extraction, `[INST]` tags |
| PII redaction | Detects & redacts email, phone, SSN, credit card, Aadhaar, PAN |
| Output filtering | Blocks API keys, passwords, tokens from agent output |
| Rate limiting | 30 req/min per agent per founder |
| Budget enforcement | Daily limits: 100k tokens, 50 tasks, $5 cost per agent |
| Audit trail | Every security decision logged to `GuardrailAudit` table |

### Evaluation System (LLM-as-Judge)

- **5 dimensions**: accuracy, relevance, completeness, tool usage, safety (0-100 each)
- **Regression detection** — auto-alerts when score drops >15%
- **Auto-eval** — 20% of completed tasks automatically evaluated
- **Test case seeding** — default test suites for 6 key agents
- **Feedback generation** — LLM generates actionable improvement suggestions

### Self-Improving Agents

- **Learn from failures** — error patterns written to memory
- **Learn from success** — successful tool sequences recorded
- **Working memory** — each agent tracks last 20 task outcomes per founder
- **Memory consolidation** — LLM identifies duplicate/outdated memories and archives them
- **Performance metrics** — reliability, tool usage stats, improvement notes

### Risk Tiers (Founder-Configurable)

| Tier | Behavior | Examples |
|---|---|---|
| AUTO_EXECUTE (Tier 1) | Runs immediately | Research queries, internal analytics |
| NOTIFY_AND_ACT (Tier 2) | Runs + notifies founder | Content drafts, social posts |
| APPROVAL_REQUIRED (Tier 3) | Waits for founder approval | Financial transactions, external comms |

**Enhanced with:**
- Per-layer autonomy settings (founder configurable)
- External communication detection (email/social always require approval)
- Destructive action detection (delete/remove/cancel require approval)
- Spend limit enforcement (amount extracted from tool args)
- Time restrictions (marketing actions outside business hours restricted)
- Composite risk scoring (0-100 with factor breakdown)

### State & Memory

- **6 memory types**: TASK_OUTPUT, DECISION, CONTEXT, CONSTRAINT, USER_PREFERENCE, ERROR
- **3 confidence levels**: HIGH, MEDIUM, LOW
- **LLM-based conflict detection** between new and existing memories
- **Supersede chains** for memory versioning
- **Constraint → runtime-config bridge** for dynamic agent behavior
- **Conversation history** persisted across sessions

### Observability

- Full **trace/span hierarchy** for every agent execution
- **Alerting rules** with configurable thresholds
- **Agent performance leaderboard** (task count, success rate, avg duration)
- **Cost tracking** per task with token counting
- **Request ID tracking** for debugging across services

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
- **HTTP execution** through `McpConnectorExecutor` with auth header building

### Production Security

- **Security headers** — X-Frame-Options, CSP, HSTS, X-XSS-Protection
- **SQL injection prevention** — UUID format validation + parameterized queries
- **Request ID tracking** — every request gets a UUID for debugging
- **Error sanitization** — internal errors hidden when `NODE_ENV=production`
- **Graceful shutdown** — `enableShutdownHooks()` for clean process exit
- **Structured logging** — method, path, IP, user-agent on errors

### Frontend

- **Feedly-inspired landing page** — hero, pain points, pillars, how-it-works, use cases, timeline, footer
- **Voice input** — Web Speech API for speech-to-text in chat
- **Custom 404 page** with theme-consistent styling
- **Loading states** for route transitions
- **SEO metadata** — OpenGraph, Twitter cards, viewport, keywords

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
# GROQ_API_KEY (primary), ANTHROPIC_API_KEY (optional fallback),
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
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

### Health
| Method | Path | Description |
|---|---|---|
| GET | /health | Full health check (DB, memory, uptime) |
| GET | /health/ready | Readiness probe |
| GET | /health/live | Liveness probe |

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

### Backend
| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string |
| JWT_SECRET | Yes | Secure random string for JWT signing (min 32 chars) |
| GROQ_API_KEY | Yes | Groq API key (free tier, primary LLM) |
| ANTHROPIC_API_KEY | No | Anthropic API key (fallback LLM) |
| SUPABASE_URL | No | Supabase project URL |
| SUPABASE_ANON_KEY | No | Supabase anonymous key |
| SUPABASE_SERVICE_ROLE_KEY | No | Supabase service role key |
| PORT | No | Backend port (default: 3001) |
| FRONTEND_URL | No | Frontend URL for CORS (default: http://localhost:3000) |

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

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete production deployment guide including Docker setup, SSL configuration, monitoring, and troubleshooting.

## License

MIT
