-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types if they don't exist
DO $$ BEGIN
  CREATE TYPE "AgentStatus" AS ENUM ('IDLE', 'RUNNING', 'WAITING_APPROVAL', 'ERROR', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED', 'RUNNING', 'AWAITING_APPROVAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RiskTier" AS ENUM ('AUTO_EXECUTE', 'NOTIFY_AND_ACT', 'APPROVAL_REQUIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EDITED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConnectorStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Log completion
DO $$ BEGIN
  RAISE NOTICE 'Database initialization completed successfully';
END $$;
