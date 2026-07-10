import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, isSessionExpired } from './auth';
import { getSessionByToken, updateSessionLastActive, getAdminUserById, hasPermission } from './db';
import { createAuditLog, generateRequestId, extractIPAddress } from './audit';

export interface AuthContext {
  adminUserId: string;
  adminEmail: string;
  role: string;
  sessionId: string;
  ipAddress: string;
  requestId: string;
}

export interface AuthResult {
  success: boolean;
  context?: AuthContext;
  error?: {
    code: string;
    message: string;
  };
}

export async function requireAuth(
  request: NextRequest,
  requiredPermission?: string,
  scope?: Record<string, any>
): Promise<AuthResult> {
  const requestId = generateRequestId();
  const ipAddress = extractIPAddress(request.headers);
  
  // Get session token from cookie
  const sessionToken = request.cookies.get('admin_session')?.value;
  
  if (!sessionToken) {
    return {
      success: false,
      error: {
        code: 'NO_SESSION',
        message: 'No active session found',
      },
    };
  }
  
  // Verify JWT token
  const payload = await verifyToken(sessionToken);
  if (!payload) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid session token',
      },
    };
  }
  
  // Get session from database
  const session = await getSessionByToken(sessionToken);
  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      },
    };
  }
  
  // Check if session is revoked
  if (session.revokedAt) {
    return {
      success: false,
      error: {
        code: 'SESSION_REVOKED',
        message: 'Session has been revoked',
      },
    };
  }
  
  // Check if session is expired
  if (isSessionExpired(session)) {
    return {
      success: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session has expired',
      },
    };
  }
  
  // Get admin user
  const adminUser = await getAdminUserById(payload.adminUserId);
  if (!adminUser) {
    return {
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Admin user not found',
      },
    };
  }
  
  // Check if admin account is disabled
  if (adminUser.status === 'disabled') {
    return {
      success: false,
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Account has been disabled',
      },
    };
  }
  
  // Check if admin account is locked
  if (adminUser.status === 'locked') {
    const lockedUntil = adminUser.lockedUntil ? new Date(adminUser.lockedUntil) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      return {
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed login attempts',
        },
      };
    }
  }
  
  // Check permission if required
  if (requiredPermission) {
    const hasRequiredPermission = await hasPermission(adminUser.role, requiredPermission);
    
    if (!hasRequiredPermission) {
      // Log denied permission check
      await createAuditLog({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'permission.denied',
        targetType: null,
        targetId: null,
        requestId,
        ipAddress,
        sessionId: session.id,
        outcome: 'denied',
        newValue: { requiredPermission, scope },
      });
      
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action',
        },
      };
    }
  }
  
  // Update session last active time
  await updateSessionLastActive(session.id);
  
  const context: AuthContext = {
    adminUserId: adminUser.id,
    adminEmail: adminUser.email,
    role: adminUser.role,
    sessionId: session.id,
    ipAddress,
    requestId,
  };
  
  return {
    success: true,
    context,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  requestId?: string
): NextResponse {
  const body: any = {
    error: {
      code,
      message,
    },
  };
  
  if (requestId) {
    body.requestId = requestId;
  }
  
  return NextResponse.json(body, { status });
}

export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function extractPaginationParams(request: NextRequest): {
  page: number;
  limit: number;
} {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  
  return { page, limit };
}
