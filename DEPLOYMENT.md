# Helm AI OS — Production Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16 with pgvector extension
- Redis 7+
- Docker & Docker Compose (recommended)
- At least one LLM API key (Groq for free tier, or Anthropic)

## Quick Start with Docker

```bash
# 1. Clone and setup
git clone https://github.com/jjssmyhaks-dev/founderOS.git
cd founderOS

# 2. Create environment file
cp backend/.env.example backend/.env
# Edit backend/.env with your production values

# 3. Start all services
docker-compose up -d

# 4. Run database migrations
docker-compose exec backend npx prisma migrate deploy

# 5. Verify health
curl http://localhost:3001/health
```

## Production Environment Variables

### Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/helm_ai` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `JWT_SECRET` | Secure random string (min 32 chars) | `openssl rand -hex 32` |
| `GROQ_API_KEY` | Groq API key (free tier available) | `gsk_...` |

### Optional

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback LLM) | - |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `PRODUCTION_URL` | Production frontend URL | - |
| `PORT` | Backend port | `3001` |
| `NODE_ENV` | Environment | `development` |

### Frontend Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (ws:// or wss://) |
| `NEXT_PUBLIC_APP_URL` | Application URL for SEO metadata |

## Security Checklist

### Before Deploying

- [ ] Generate secure JWT_SECRET: `openssl rand -hex 32`
- [ ] Use HTTPS in production (reverse proxy with nginx/caddy)
- [ ] Set NODE_ENV=production
- [ ] Configure CORS for your production domain only
- [ ] Enable rate limiting (already included)
- [ ] Set up database backups
- [ ] Configure monitoring/alerting

### SSL/TLS Setup (nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers (already set by backend, but nginx can add more)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Setup

### Option 1: Docker (Recommended)

Docker Compose automatically provisions PostgreSQL with the required extensions.

### Option 2: Managed Database

For production, use a managed database like:
- **Supabase** (PostgreSQL + pgvector)
- **Neon** (Serverless PostgreSQL)
- **AWS RDS** / **Google Cloud SQL**

Update `DATABASE_URL` in your environment.

### Running Migrations

```bash
# Local
cd backend
npx prisma migrate deploy

# Docker
docker-compose exec backend npx prisma migrate deploy
```

## Health Checks

The backend exposes health check endpoints:

- **`/health`** — Full health check (database, memory, uptime)
- **`/health/ready`** — Readiness check for load balancers
- **`/health/live`** — Liveness check for orchestrators

### Example Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "0.1.0",
  "services": {
    "database": "connected",
    "memory": {
      "heapUsed": 85,
      "heapTotal": 120,
      "rss": 150
    }
  }
}
```

## Monitoring

### Metrics to Monitor

1. **Response Times**: p50, p95, p99 latencies
2. **Error Rates**: 4xx and 5xx responses
3. **Database**: Connection pool, query latency
4. **Memory**: Heap usage, RSS
5. **LLM Costs**: Token usage per provider

### Recommended Tools

- **APM**: Datadog, New Relic, or Sentry
- **Uptime**: UptimeRobot, Checkly
- **Logs**: Datadog Logs, Logtail, or Papertrail

## Scaling

### Vertical Scaling

- Increase RAM for more concurrent agents
- Add CPU for faster LLM processing

### Horizontal Scaling

- Use Redis for session/state sharing
- Use managed PostgreSQL with read replicas
- Deploy multiple backend instances behind load balancer

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_tasks_founder_status ON "Task"("founderId", status);
CREATE INDEX idx_tasks_agent_status ON "Task"("agentId", status);
CREATE INDEX idx_traces_founder_created ON "Trace"("founderId", "createdAt");
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Verify PostgreSQL is running
   - Check DATABASE_URL format
   - Ensure database exists

2. **Redis connection failed**
   - Verify Redis is running
   - Check REDIS_URL format

3. **JWT verification failed**
   - Ensure JWT_SECRET is set and consistent
   - Regenerate if compromised: `openssl rand -hex 32`

4. **CORS errors**
   - Add your production domain to FRONTEND_URL
   - Ensure HTTPS is properly configured

### Logs

```bash
# Docker logs
docker-compose logs -f backend

# View specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

## Backup Strategy

### Database Backups

```bash
# Manual backup
docker-compose exec postgres pg_dump -U helm helm_ai > backup_$(date +%Y%m%d).sql

# Automated (add to cron)
0 2 * * * docker-compose exec postgres pg_dump -U helm helm_ai | gzip > /backups/helm_$(date +\%Y\%m\%d).sql.gz
```

### Redis Backups

```bash
# Trigger RDB save
docker-compose exec redis redis-cli BGSAVE
```

## Support

- **Documentation**: `/api/docs` (Swagger UI)
- **Issues**: GitHub Issues
- **Contact**: hello@dozero.ai
