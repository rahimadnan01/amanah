import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable is not set or is too short. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  return new TextEncoder().encode(secret);
}

const SESSION_MAX_HOURS = 8;
const SESSION_INACTIVITY_MINUTES = 30;

export interface JWTPayload {
  adminUserId: string;
  sessionId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Password operations
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT operations
export async function createToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MAX_HOURS * 3600;

  const token = await new SignJWT({
    ...payload,
    iat: now,
    exp,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getJWTSecret());

  return token;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}

// TOTP/MFA operations
export function normalizeMFASecret(secret?: unknown): string {
  return String(secret || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function normalizeMFACode(code?: unknown): string {
  return String(code || "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

export function generateMFASecret(): { secret: string; qrCode: string } {
  const secret = speakeasy.generateSecret({
    length: 32,
    name: "Admin Panel",
    issuer: "Platform Admin",
  });

  const normalizedSecret = normalizeMFASecret(secret.base32);

  return {
    secret: normalizedSecret,
    qrCode: secret.otpauth_url || "",
  };
}

export function getOTPAuthURL(secret: string): string {
  return speakeasy.otpauthURL({
    secret: normalizeMFASecret(secret),
    label: "Admin Panel",
    issuer: "Platform Admin",
    encoding: "base32",
  });
}

export async function generateQRCodeDataURL(
  otpauthUrl: string,
): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyMFACode(secret: string, token: string): boolean {
  const normalizedSecret = normalizeMFASecret(secret);
  const normalizedToken = normalizeMFACode(token);

  if (!normalizedSecret || normalizedToken.length !== 6) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: normalizedSecret,
    encoding: "base32",
    token: normalizedToken,
    window: 2,
    digits: 6,
    step: 30,
    algorithm: "sha1",
  });
}

// Session validation
export function isSessionExpired(session: {
  expiresAt: string;
  lastActiveAt: string;
}): boolean {
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  const lastActiveAt = new Date(session.lastActiveAt);

  // Check absolute expiry
  if (now > expiresAt) {
    return true;
  }

  // Check inactivity expiry (30 minutes)
  const inactivityExpiry = new Date(
    lastActiveAt.getTime() + SESSION_INACTIVITY_MINUTES * 60 * 1000,
  );
  if (now > inactivityExpiry) {
    return true;
  }

  return false;
}

export function getSessionExpiryTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + SESSION_MAX_HOURS * 60 * 60 * 1000);
}

// Cookie settings
export const COOKIE_NAME = "admin_session";

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict" as const,
      path: "/",
      maxAge: SESSION_MAX_HOURS * 3600,
    },
  };
}
