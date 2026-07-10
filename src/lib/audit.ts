import { createAuditLog as dbCreateAuditLog, redactSensitiveFields } from './db';

export interface AuditLogData {
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  previousValue?: any;
  newValue?: any;
  reason?: string | null;
  requestId: string;
  ipAddress: string;
  sessionId?: string | null;
  outcome: 'success' | 'failure' | 'denied';
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  await dbCreateAuditLog({
    adminUserId: data.adminUserId,
    adminEmail: data.adminEmail,
    action: data.action,
    targetType: data.targetType || null,
    targetId: data.targetId || null,
    previousValue: data.previousValue !== undefined ? redactSensitiveFields(data.previousValue) : null,
    newValue: data.newValue !== undefined ? redactSensitiveFields(data.newValue) : null,
    reason: data.reason || null,
    requestId: data.requestId,
    ipAddress: data.ipAddress,
    sessionId: data.sessionId || null,
    outcome: data.outcome,
  });
}

// Helper to generate a unique request ID
export function generateRequestId(): string {
  return `req_${Math.random().toString(16).substring(2, 18)}`;
}

// Helper to extract IP address from request headers
export function extractIPAddress(headers: Headers): string {
  const xForwardedFor = headers.get('x-forwarded-for');
  const xRealIP = headers.get('x-real-ip');
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  return 'unknown';
}
