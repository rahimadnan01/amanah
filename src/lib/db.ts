import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Add it in your Vercel project's Environment Variables (Storage tab) or .env.local for local dev.",
    );
  }
  _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// Proxy so existing `sql\`...\`` call sites below don't need to change
const sql: NeonQueryFunction<false, false> = ((...args: Parameters<NeonQueryFunction<false, false>>) =>
  getSql()(...args)) as NeonQueryFunction<false, false>;

// Database schema types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role:
    | "super_admin"
    | "moderator"
    | "support_agent"
    | "operations_admin"
    | "analyst";
  status: "active" | "disabled" | "locked";
  passwordHash: string;
  mfaSecret: string | null;
  pendingMfaSecret: string | null;
  mfaEnabled: boolean;
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedReason: string | null;
  lastActiveAt: string;
}

export interface AuditLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  requestId: string;
  ipAddress: string;
  sessionId: string | null;
  outcome: "success" | "failure" | "denied";
  timestamp: string;
}

export interface RolePermission {
  role: string;
  permissions: string[];
}

// Role permissions configuration (static, not stored in DB)
const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: "super_admin",
    permissions: [
      "admins.view",
      "admins.create",
      "admins.edit",
      "admins.disable",
      "admins.manage",
      "users.view",
      "users.search",
      "users.suspend",
      "users.ban",
      "users.restore",
      "users.export",
      "users.delete_permanent",
      "content.view",
      "content.remove",
      "content.restore",
      "reports.view",
      "reports.resolve",
      "reports.escalate",
      "sessions.view",
      "sessions.revoke",
      "audit.view",
      "audit.export",
      "settings.view",
      "settings.edit",
      "feature_flags.view",
      "feature_flags.edit",
      "media.view",
      "media.retry",
      "roles.manage",
    ],
  },
  {
    role: "moderator",
    permissions: [
      "users.view",
      "users.search",
      "users.suspend",
      "users.restore",
      "content.view",
      "content.remove",
      "content.restore",
      "reports.view",
      "reports.resolve",
      "reports.escalate",
      "sessions.view",
      "sessions.revoke",
      "audit.view",
    ],
  },
  {
    role: "support_agent",
    permissions: [
      "users.view",
      "users.search",
      "sessions.view",
      "sessions.revoke",
      "reports.view",
      "audit.view",
    ],
  },
  {
    role: "operations_admin",
    permissions: [
      "media.view",
      "media.retry",
      "settings.view",
      "settings.edit",
      "feature_flags.view",
      "feature_flags.edit",
      "audit.view",
    ],
  },
  {
    role: "analyst",
    permissions: [
      "users.view",
      "reports.view",
      "audit.view",
      "content.view",
      "sessions.view",
      "sessions.revoke",
    ],
  },
];

// --- Row <-> domain object mapping helpers ---

function rowToAdminUser(row: any): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    mfaSecret: row.mfa_secret,
    pendingMfaSecret: row.pending_mfa_secret,
    mfaEnabled: row.mfa_enabled,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until ? new Date(row.locked_until).toISOString() : null,
  };
}

function rowToSession(row: any): AdminSession {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    token: row.token,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    revokedBy: row.revoked_by,
    revokedReason: row.revoked_reason,
    lastActiveAt: new Date(row.last_active_at).toISOString(),
  };
}

function rowToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    previousValue: row.previous_value,
    newValue: row.new_value,
    reason: row.reason,
    requestId: row.request_id,
    ipAddress: row.ip_address,
    sessionId: row.session_id,
    outcome: row.outcome,
    timestamp: new Date(row.timestamp).toISOString(),
  };
}

function stripSecrets(
  user: AdminUser,
): Omit<AdminUser, "passwordHash" | "mfaSecret" | "pendingMfaSecret"> {
  const { passwordHash, mfaSecret, pendingMfaSecret, ...rest } = user;
  return rest;
}

// --- Admin User Operations ---

export async function getAdminUserByEmail(
  email: string,
): Promise<AdminUser | null> {
  const normalizedEmail = email.toLowerCase();
  const rows = await sql`SELECT * FROM admin_users WHERE email = ${normalizedEmail}`;
  return rows.length > 0 ? rowToAdminUser(rows[0]) : null;
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const rows = await sql`SELECT * FROM admin_users WHERE id = ${id}`;
  return rows.length > 0 ? rowToAdminUser(rows[0]) : null;
}

export async function getAllAdminUsers(): Promise<
  Omit<AdminUser, "passwordHash" | "mfaSecret" | "pendingMfaSecret">[]
> {
  const rows = await sql`SELECT * FROM admin_users ORDER BY created_at ASC`;
  return rows.map((row) => stripSecrets(rowToAdminUser(row)));
}

export async function createAdminUser(data: {
  email: string;
  name: string;
  role: AdminUser["role"];
  password: string;
  createdBy: string;
}): Promise<Omit<AdminUser, "passwordHash" | "mfaSecret" | "pendingMfaSecret">> {
  const normalizedEmail = data.email.toLowerCase();

  const existing = await sql`SELECT id FROM admin_users WHERE email = ${normalizedEmail}`;
  if (existing.length > 0) {
    throw new Error("Email already exists");
  }

  const id = `adm_${uuidv4()}`;
  const passwordHash = bcrypt.hashSync(data.password, 12);

  const rows = await sql`
    INSERT INTO admin_users (id, email, name, role, status, password_hash, mfa_enabled, created_by, failed_login_attempts)
    VALUES (${id}, ${normalizedEmail}, ${data.name}, ${data.role}, ${"active"}, ${passwordHash}, false, ${data.createdBy}, 0)
    RETURNING *
  `;

  return stripSecrets(rowToAdminUser(rows[0]));
}

export async function updateAdminUser(
  id: string,
  updates: Partial<Pick<AdminUser, "role" | "status" | "name">>,
  requestId: string,
): Promise<Omit<AdminUser, "passwordHash" | "mfaSecret" | "pendingMfaSecret"> | null> {
  const existingRows = await sql`SELECT * FROM admin_users WHERE id = ${id}`;
  if (existingRows.length === 0) {
    return null;
  }

  const current = rowToAdminUser(existingRows[0]);
  const merged = { ...current, ...updates };

  const rows = await sql`
    UPDATE admin_users
    SET role = ${merged.role}, status = ${merged.status}, name = ${merged.name}
    WHERE id = ${id}
    RETURNING *
  `;

  return stripSecrets(rowToAdminUser(rows[0]));
}

export async function incrementFailedLoginAttempts(
  email: string,
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const rows = await sql`SELECT * FROM admin_users WHERE email = ${normalizedEmail}`;
  if (rows.length === 0) return;

  const user = rowToAdminUser(rows[0]);
  const newAttempts = user.failedLoginAttempts + 1;

  if (newAttempts >= 5) {
    const lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await sql`
      UPDATE admin_users
      SET failed_login_attempts = ${newAttempts}, locked_until = ${lockedUntil}, status = ${"locked"}
      WHERE id = ${user.id}
    `;
  } else {
    await sql`
      UPDATE admin_users SET failed_login_attempts = ${newAttempts} WHERE id = ${user.id}
    `;
  }
}

export async function resetFailedLoginAttempts(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const rows = await sql`SELECT * FROM admin_users WHERE email = ${normalizedEmail}`;
  if (rows.length === 0) return;

  const user = rowToAdminUser(rows[0]);
  const newStatus = user.status === "locked" ? "active" : user.status;

  await sql`
    UPDATE admin_users
    SET failed_login_attempts = 0, locked_until = NULL, status = ${newStatus}
    WHERE id = ${user.id}
  `;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await sql`UPDATE admin_users SET last_login_at = now() WHERE id = ${userId}`;
}

export async function enableMFA(userId: string, secret: string): Promise<void> {
  await sql`
    UPDATE admin_users
    SET mfa_secret = ${secret}, pending_mfa_secret = NULL, mfa_enabled = true
    WHERE id = ${userId}
  `;
}

export async function setPendingMFASecret(
  userId: string,
  secret: string,
): Promise<void> {
  await sql`UPDATE admin_users SET pending_mfa_secret = ${secret} WHERE id = ${userId}`;
}

export async function clearPendingMFASecret(userId: string): Promise<void> {
  await sql`UPDATE admin_users SET pending_mfa_secret = NULL WHERE id = ${userId}`;
}

export async function disableAdminUser(userId: string): Promise<void> {
  await sql`UPDATE admin_users SET status = ${"disabled"} WHERE id = ${userId}`;

  await sql`
    UPDATE admin_sessions
    SET revoked_at = now(), revoked_reason = ${"Account disabled"}
    WHERE admin_user_id = ${userId} AND revoked_at IS NULL
  `;
}

export async function enableAdminUser(userId: string): Promise<void> {
  await sql`
    UPDATE admin_users
    SET status = ${"active"}, failed_login_attempts = 0, locked_until = NULL
    WHERE id = ${userId}
  `;
}

// --- Session Operations ---

export async function createSession(data: {
  adminUserId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
}): Promise<AdminSession> {
  const id = `ses_${uuidv4()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours absolute max

  const rows = await sql`
    INSERT INTO admin_sessions (id, admin_user_id, token, ip_address, user_agent, expires_at)
    VALUES (${id}, ${data.adminUserId}, ${data.token}, ${data.ipAddress}, ${data.userAgent}, ${expiresAt.toISOString()})
    RETURNING *
  `;

  return rowToSession(rows[0]);
}

export async function getSessionByToken(
  token: string,
): Promise<AdminSession | null> {
  const rows = await sql`SELECT * FROM admin_sessions WHERE token = ${token}`;
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export async function updateSessionLastActive(
  sessionId: string,
): Promise<void> {
  await sql`UPDATE admin_sessions SET last_active_at = now() WHERE id = ${sessionId}`;
}

export async function updateSessionToken(
  sessionId: string,
  token: string,
): Promise<void> {
  await sql`UPDATE admin_sessions SET token = ${token} WHERE id = ${sessionId}`;
}

export async function revokeSession(
  sessionId: string,
  revokedBy: string | null = null,
  reason: string | null = null,
): Promise<boolean> {
  const rows = await sql`
    UPDATE admin_sessions
    SET revoked_at = now(), revoked_by = ${revokedBy}, revoked_reason = ${reason}
    WHERE id = ${sessionId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function revokeAllSessionsExceptCurrent(
  adminUserId: string,
  currentSessionId: string,
  revokedBy: string | null = null,
  reason: string | null = null,
): Promise<number> {
  const rows = await sql`
    UPDATE admin_sessions
    SET revoked_at = now(), revoked_by = ${revokedBy}, revoked_reason = ${reason || "Revoke all sessions"}
    WHERE admin_user_id = ${adminUserId} AND id != ${currentSessionId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length;
}

export async function revokeAllSessionsForAdmin(
  adminUserId: string,
  revokedBy: string,
  reason: string,
): Promise<number> {
  const rows = await sql`
    UPDATE admin_sessions
    SET revoked_at = now(), revoked_by = ${revokedBy}, revoked_reason = ${reason}
    WHERE admin_user_id = ${adminUserId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length;
}

export async function getSessionsByAdminUserId(
  adminUserId: string,
): Promise<AdminSession[]> {
  const rows = await sql`
    SELECT * FROM admin_sessions WHERE admin_user_id = ${adminUserId} ORDER BY created_at DESC
  `;
  return rows.map(rowToSession);
}

export async function getAllSessions(): Promise<AdminSession[]> {
  const rows = await sql`SELECT * FROM admin_sessions ORDER BY created_at DESC`;
  return rows.map(rowToSession);
}

export async function revokeSessionByToken(token: string): Promise<boolean> {
  const rows = await sql`
    UPDATE admin_sessions
    SET revoked_at = now(), revoked_reason = ${"Logout"}
    WHERE token = ${token} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

// --- Audit Log Operations ---

export async function createAuditLog(
  data: Omit<AuditLog, "id" | "timestamp">,
): Promise<AuditLog> {
  const id = `aud_${uuidv4()}`;

  const rows = await sql`
    INSERT INTO audit_logs (
      id, admin_user_id, admin_email, action, target_type, target_id,
      previous_value, new_value, reason, request_id, ip_address, session_id, outcome
    ) VALUES (
      ${id}, ${data.adminUserId}, ${data.adminEmail}, ${data.action}, ${data.targetType}, ${data.targetId},
      ${data.previousValue}, ${data.newValue}, ${data.reason}, ${data.requestId}, ${data.ipAddress}, ${data.sessionId}, ${data.outcome}
    )
    RETURNING *
  `;

  return rowToAuditLog(rows[0]);
}

export async function getAuditLogs(filters?: {
  action?: string;
  adminUserId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const page = filters?.page || 1;
  const limit = Math.min(filters?.limit || 25, 100);
  const offset = (page - 1) * limit;

  const actionFilter = filters?.action ? `%${filters.action.toLowerCase()}%` : null;

  const rows = await sql`
    SELECT * FROM audit_logs
    WHERE (${actionFilter}::text IS NULL OR LOWER(action) LIKE ${actionFilter})
      AND (${filters?.adminUserId ?? null}::text IS NULL OR admin_user_id = ${filters?.adminUserId ?? null})
      AND (${filters?.fromDate ?? null}::timestamptz IS NULL OR "timestamp" >= ${filters?.fromDate ?? null}::timestamptz)
      AND (${filters?.toDate ?? null}::timestamptz IS NULL OR "timestamp" <= ${filters?.toDate ?? null}::timestamptz)
    ORDER BY "timestamp" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql`
    SELECT COUNT(*)::int AS count FROM audit_logs
    WHERE (${actionFilter}::text IS NULL OR LOWER(action) LIKE ${actionFilter})
      AND (${filters?.adminUserId ?? null}::text IS NULL OR admin_user_id = ${filters?.adminUserId ?? null})
      AND (${filters?.fromDate ?? null}::timestamptz IS NULL OR "timestamp" >= ${filters?.fromDate ?? null}::timestamptz)
      AND (${filters?.toDate ?? null}::timestamptz IS NULL OR "timestamp" <= ${filters?.toDate ?? null}::timestamptz)
  `;

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: rows.map(rowToAuditLog),
    pagination: { total, page, limit, totalPages },
  };
}

// --- Role Permission Operations (static, no DB round-trip needed) ---

export async function getRolePermissions(role: string): Promise<string[]> {
  const roleConfig = ROLE_PERMISSIONS.find((rp) => rp.role === role);
  return roleConfig?.permissions || [];
}

export async function hasPermission(
  role: string,
  permission: string,
): Promise<boolean> {
  const permissions = await getRolePermissions(role);
  return permissions.includes(permission);
}

export async function getAllRolePermissions(): Promise<RolePermission[]> {
  return ROLE_PERMISSIONS;
}

// Helper function to redact sensitive values from objects before logging
export function redactSensitiveFields(obj: any): string | null {
  if (!obj) return null;

  const sensitiveFields = [
    "password",
    "passwordHash",
    "hash",
    "secret",
    "mfaSecret",
    "token",
    "accessToken",
    "refreshToken",
  ];

  const redacted = { ...obj };

  for (const field of sensitiveFields) {
    if (redacted[field] !== undefined) {
      redacted[field] = "[REDACTED]";
    }
  }

  return JSON.stringify(redacted);
}
