/**
 * One-time Postgres setup: creates tables and seeds the super admin account.
 * Usage: node scripts/db-setup.js
 * Requires DATABASE_URL to be set (e.g. via `vercel env pull` or your local .env.local)
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { neon } = require("@neondatabase/serverless");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set. Run `vercel env pull .env.local` first, or set it manually.");
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log("Creating tables (if they don't already exist)...");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  // neon() only runs one statement per call, so split on ";" and run each
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql(statement);
  }
  console.log("✅ Tables ready.");

  const existing = await sql`SELECT id FROM admin_users WHERE email = ${"superadmin@platform.com"}`;

  if (existing.length > 0) {
    console.log("ℹ️  Super admin account already exists, skipping seed.");
    return;
  }

  const id = `adm_${randomUUID()}`;
  const passwordHash = bcrypt.hashSync("Admin@123456", 12);

  await sql`
    INSERT INTO admin_users (id, email, name, role, status, password_hash, mfa_enabled, failed_login_attempts)
    VALUES (${id}, ${"superadmin@platform.com"}, ${"Super Admin"}, ${"super_admin"}, ${"active"}, ${passwordHash}, false, 0)
  `;

  console.log("✅ Seeded super admin account:");
  console.log("   Email:    superadmin@platform.com");
  console.log("   Password: Admin@123456");
  console.log("⚠️  Log in and change this password immediately.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Setup failed:", err);
    process.exit(1);
  });
