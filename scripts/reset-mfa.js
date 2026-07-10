/**
 * Reset MFA for a specific user (or all users)
 * Usage: node scripts/reset-mfa.js <email>
 * Usage: node scripts/reset-mfa.js --all
 * Requires DATABASE_URL to be set.
 */
const { neon } = require("@neondatabase/serverless");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }
  const sql = neon(connectionString);

  const target = process.argv[2];

  if (!target) {
    console.log("Usage: node scripts/reset-mfa.js <email>");
    console.log("       node scripts/reset-mfa.js --all");
    console.log("\nCurrent MFA status:");
    const users = await sql`SELECT email, mfa_enabled FROM admin_users ORDER BY email`;
    users.forEach((u) => {
      console.log(`  ${u.email} | mfaEnabled=${u.mfa_enabled}`);
    });
    process.exit(0);
  }

  let rows;
  if (target === "--all") {
    rows = await sql`
      UPDATE admin_users SET mfa_enabled = false, mfa_secret = NULL, pending_mfa_secret = NULL
      RETURNING email
    `;
  } else {
    rows = await sql`
      UPDATE admin_users SET mfa_enabled = false, mfa_secret = NULL, pending_mfa_secret = NULL
      WHERE email = ${target}
      RETURNING email
    `;
  }

  if (rows.length === 0) {
    console.log(`❌ No user found with email: ${target}`);
    process.exit(1);
  }

  rows.forEach((u) => console.log(`✅ Reset MFA for ${u.email}`));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  });
