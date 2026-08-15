# FounderOS (Helm)

**AI Operating System for Solo Founders** — an autonomous agent platform that manages research, marketing, operations, and finance through 21 specialized sub-agents, 5 orchestrators, and a unified harness runtime.

## Architecture

```
Founder Chat/Request
        │
        ▼
┌─────────────────────┐
│ Global Orchestrator  │ ← Intent classification + routing
└────────┬────────────┘
         │
    ┌────┼────┬────┐
    ▼    ▼    ▼    ▼
┌──────┐┌──────┐┌──────┐┌──────┐
│Research│Marketing│Operations│Finance│
│Orch.   │Orch.   │Orch.    │Orch.  │
└──┬───┘└──┬───┘└──┬────┘└──┬───┘
   │       │       │        │
   ▼       ▼       ▼        ▼
 5 agents 6 agents 5 agents 5 agents
   │       │       │        │
   └───────┴───────┴────────┘
           │
     ┌─────┴─────┐
     │  Agent     │ ← Shared execution harness
     │  Runtime    │   (tool calling, risk gates,
     └─────┬─────┘    context, state persistence)
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
  LLM   Tools   DB
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL with pgvector |
| LLM | Anthropic Claude (via SDK v0.10.2) |
| Frontend | Next.js 14, React, Tailwind CSS |
| State | Zustand stores |
| Events | Redis Pub/Sub |
| Auth | JWT (bcrypt hashed passwords) |

## Monorepo Structure

```
helm-ai-os/
├── packages/
│   ├── shared/          # Shared types and enums
│   │   └── src/index.ts
│   ├── backend/         # NestJS API server
│   │   ├── prisma/
│   │   │   └── schema.prisma   # 14 tables (User, Task, TaskStep, Agent, Approval, etc.)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── auth/             # JWT auth (signup/login)
│   │       ├── agents/           # 21 agents + 5 orchestrators registry
│   │       ├── agent-runtime/    # Shared execution harness (core!)
│   │       │   ├── types.ts                  # AgentTask, ToolDefinition, etc.
│   │       │   ├── agent-runtime.service.ts   # Execution loop
│   │       │   ├── tool-registry.service.ts   # Tool schema + per-agent filtering
│   │       │   ├── context-assembler.service.ts # Context + token budget
│   │       │   ├── risk-gate.service.ts       # Pre-execution risk checks
│   │       │   ├── mcp-connector-executor.service.ts # MCP HTTP tool calls
│   │       │   ├── token-budget.service.ts    # Token counting + truncation
│   │       │   ├── handoff.service.ts         # Cross-layer event handoff
│   │       │   ├── crash-recovery.service.ts  # Resume stalled tasks
│   │       │   ├── scheduled-trigger.service.ts # Cron-style triggers
│   │       │   └── agent-runtime.controller.ts # API endpoints
│   │       ├── tasks/            # Task CRUD
│   │       ├── events/           # Redis event bus
│   │       ├── approvals/        # Approval queue
│   │       ├── connectors/       # 15 external connectors
│   │       ├── context/          # Context notes + pgvector search
│   │       ├── activity/         # Activity feed
│   │       ├── llm/              # Claude LLM wrapper
│   │       ├── chat/             # Chat sessions + message storage
│   │       ├── orchestration/    # Global orchestrator (LLM routing)
│   │       └── layers/           # 4 layer services (research/marketing/ops/finance)
│   └── frontend/        # Next.js 14 App Router
│       └── src/
│           ├── app/
│           │   ├── page.tsx              # Main chat interface
│           │   ├── settings/page.tsx     # Per-layer autonomy settings
│           │   └── admin/page.tsx        # Observability dashboard
│           ├── components/
│           │   ├── Login.tsx, AppShell.tsx, AppHeader.tsx
│           │   ├── ChatPane.tsx, MessageList.tsx, ChatInput.tsx
│           │   ├── SidePanel.tsx
│           │   ├── ApprovalQueue.tsx, ConnectorPanel.tsx
│           │   ├── ActivityFeed.tsx
│           │   └── TaskTraceViewer.tsx
│           ├── stores/   # Zustand (auth, chat, approvals, connectors, activity)
│           ├── hooks/   # React hooks
│           └── config/   # Agent & connector definitions
├── package.json          # Root workspace config
├── .env.example
└── README.md
```

## Agent Harness

Every agent (21 sub-agents + 5 orchestrators) runs on the **same shared harness**. The harness implements:

- **Execution loop**: LLM call → tool parse → risk gate → execute → inject result → repeat
- **Risk tier gating**: AUTO_EXECUTE (pass), NOTIFY_AND_ACT (pass + log), APPROVAL_REQUIRED (block + approval queue)
- **Tool calling**: 5 internal tools (context query, events, approvals, escalation, activity) + MCP connector tools
- **Idempotency**: Cached tool results by `taskId:step:toolName` to prevent double execution
- **State persistence**: Every step saved to `TaskStep` table for full replay/debugging
- **Context assembly**: System prompt + goal + pgvector context notes + recent activity, with token budget enforcement
- **Crash recovery**: On startup, resumes any tasks stuck in RUNNING state
- **Horizontal handoff**: Cross-layer event subscriptions trigger new agent tasks
- **Scheduled triggers**: Cron-style agent activation (daily competitor scan, weekly content review, etc.)
- **Approval resolution**: Asynchronous resume with founder decision injected as context turn

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- Redis 7+
- Anthropic API key

### Setup

```bash
# Clone
gh repo clone jjssmyhaks-dev/founderOS

# Install dependencies
cd helm-ai-os
npm install

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, JWT_SECRET

# Database setup
cd packages/backend
npx prisma generate
npx prisma db push

# Run backend (port 3001)
npm run dev

# Run frontend (port 3000, in new terminal)
cd ../frontend
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `JWT_SECRET` | Secret for JWT token signing |
| `PORT` | Backend port (default: 3001) |

## 21 Sub-Agents

| Layer | Agents |
|-------|--------|
| **Research** | Competitor Intelligence, Market Trend Scanning, Pricing Benchmarking, Customer & Audience Research, Campaign Deep-Dive |
| **Marketing** | Content Copywriter, Social Media Manager, Performance Marketer, Brand Voice Guardian, Email Marketer, SEO Content Strategist |
| **Operations** | Scheduling Coordinator, Notification Manager, Process Automator, Vendor Liaison, Compliance Tracker |
| **Finance** | Bookkeeper, GST Compliance Agent, Cashflow Forecaster, Invoice & Receipt Tracker, Banking API Agent |

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register founder account |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/chat/sessions` | Create chat session |
| POST | `/chat/sessions/:id/messages` | Send message (triggers orchestrator) |
| GET | `/agents` | List all 26 agents |
| GET | `/tasks` | List tasks with filters |
| POST | `/agent-runtime/execute` | Execute task on agent |
| POST | `/agent-runtime/:taskId/approve` | Approve blocked task |
| GET | `/agent-runtime/tasks/:taskId/trace` | Full task execution trace |
| GET | `/agent-runtime/stats` | Agent performance stats |
| GET | `/approvals` | Approval queue |
| GET | `/connectors` | Connector status |

## Risk Tiers

| Tier | Behavior | Default Layers |
|------|----------|---------------|
| AUTO_EXECUTE | Immediate, logged | — |
| NOTIFY_AND_ACT | Execute + notify | Research, Marketing, Operations |
| APPROVAL_REQUIRED | Block until founder approves | Finance |

## Frontend Routes

| Route | Purpose |
|-------|---------|
| `/` | Main chat interface with AI |
| `/settings` | Per-layer autonomy controls |
| `/admin` | Agent performance, connector health, scheduled triggers |

## License

MIT
