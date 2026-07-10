import { SignJWT, jwtVerify } from 'jose';

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

// JWT operations (Edge Runtime compatible)
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (SESSION_MAX_HOURS * 3600);
  
  const token = await new SignJWT({
    ...payload,
    iat: now,
    exp,
  })
    .setProtectedHeader({ alg: 'HS256' })
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

// Session validation (Edge Runtime compatible)
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
  const inactivityExpiry = new Date(lastActiveAt.getTime() + SESSION_INACTIVITY_MINUTES * 60 * 1000);
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
export const COOKIE_NAME = 'admin_session';

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    name: COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: SESSION_MAX_HOURS * 3600,
    },
  };
}
