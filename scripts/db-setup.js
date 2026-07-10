/**
 * One-time Postgres setup: creates tables and seeds the super admin account.
 * Usage: node scripts/db-setup.js
 */

// Load .env.local manually — Node.js does not read it automatically
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
  console.log("✅ Loaded environment from .env.local");
} else {
  console.warn("⚠️  No .env.local file found.");
}

const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { neon } = require("@neondatabase/serverless");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("🔌 Connecting to database...");
  const sql = neon(connectionString);

  // ── Create tables using tagged template literals (new Neon API) ──────────

  console.log("📋 Creating tables...");

  await sql`
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
    )
  `;
  console.log("  ✓ admin_users table ready");

  await sql`
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
    )
  `;
  console.log("  ✓ admin_sessions table ready");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON admin_sessions(token)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_admin_user
    ON admin_sessions(admin_user_id)
  `;

  await sql`
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
    )
  `;
  console.log("  ✓ audit_logs table ready");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp
    ON audit_logs("timestamp" DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_admin_user
    ON audit_logs(admin_user_id)
  `;

  console.log("✅ All tables ready.");

  // ── Seed super admin if not already exists ────────────────────────────────

  const existing = await sql`
    SELECT id FROM admin_users WHERE email = ${"superadmin@platform.com"}
  `;

  if (existing.length > 0) {
    console.log("ℹ️  Super admin already exists — skipping seed.");
    console.log("✅ Database setup complete.");
    return;
  }

  const id = `adm_${randomUUID()}`;
  const passwordHash = bcrypt.hashSync("Admin@123456", 12);
  const email = "superadmin@platform.com";
  const name = "Super Admin";
  const role = "super_admin";
  const status = "active";

  await sql`
    INSERT INTO admin_users (
      id, email, name, role, status,
      password_hash, mfa_enabled, failed_login_attempts
    ) VALUES (
      ${id}, ${email}, ${name}, ${role}, ${status},
      ${passwordHash}, false, 0
    )
  `;

  console.log("");
  console.log("✅ Super admin account created:");
  console.log("   Email:    superadmin@platform.com");
  console.log("   Password: Admin@123456");
  console.log("");
  console.log("⚠️  Log in and set up MFA immediately after first login.");
  console.log("✅ Database setup complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Setup failed:", err.message);
    process.exit(1);
  });
