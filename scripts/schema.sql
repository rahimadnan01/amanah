-- Admin Panel Postgres schema
-- Run via: npm run db:setup

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  mfa_secret TEXT,
  pending_mfa_secret TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoked_reason TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_admin_user ON admin_sessions(admin_user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  request_id TEXT NOT NULL,
  ip_address TEXT,
  session_id TEXT,
  outcome TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_admin_user ON audit_logs(admin_user_id);
