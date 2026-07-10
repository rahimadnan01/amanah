import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse, createSuccessResponse, extractPaginationParams } from '@/lib/middleware';
import {
  getSessionsByAdminUserId,
  getAllSessions,
  revokeSession,
  revokeAllSessionsExceptCurrent,
  revokeAllSessionsForAdmin,
  getAdminUserById,
} from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// GET - List sessions
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request, 'sessions.view');
  
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      authResult.error!.code === 'PERMISSION_DENIED' ? 403 : 401,
      authResult.context?.requestId
    );
  }
  
  const { adminUserId, adminEmail, role, requestId, sessionId: currentSessionId } = authResult.context!;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetAdminId = searchParams.get('adminUserId');
    
    let sessions;
    
    // Super admin can view any admin's sessions
    if (role === 'super_admin' && targetAdminId) {
      const targetAdmin = await getAdminUserById(targetAdminId);
      if (!targetAdmin) {
        return createErrorResponse(
          'USER_NOT_FOUND',
          'Target admin user not found',
          404,
          requestId
        );
      }
      sessions = await getSessionsByAdminUserId(targetAdminId);
    } else {
      // Regular admins can only view their own sessions
      sessions = await getSessionsByAdminUserId(adminUserId);
    }
    
    // Mark current session
    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
    
    return createSuccessResponse({
      sessions: sessionsWithCurrent,
    });
  } catch (error) {
    console.error('Get sessions error:', error, requestId);
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while fetching sessions',
      500,
      requestId
    );
  }
}

// DELETE - Revoke session(s)
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request, 'sessions.revoke');
  
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      authResult.error!.code === 'PERMISSION_DENIED' ? 403 : 401,
      authResult.context?.requestId
    );
  }
  
  const { adminUserId, adminEmail, role, requestId, sessionId: currentSessionId } = authResult.context!;
  
  try {
    const body = await request.json();
    const { sessionId, revokeAll, reason, targetAdminId } = body;
    
    let revokedCount = 0;
    
    // Super Admin can revoke another admin's sessions
    if (targetAdminId && targetAdminId !== adminUserId) {
      // Must be super admin to revoke another admin's sessions
      if (role !== 'super_admin') {
        return createErrorResponse(
          'PERMISSION_DENIED',
          'Only Super Administrators can revoke another administrator\'s sessions',
          403,
          requestId
        );
      }

      // Verify target admin exists
      const targetAdmin = await getAdminUserById(targetAdminId);
      if (!targetAdmin) {
        return createErrorResponse('USER_NOT_FOUND', 'Target admin user not found', 404, requestId);
      }

      // Revoke ALL sessions for the target admin (no "except current" exclusion)
      revokedCount = await revokeAllSessionsForAdmin(targetAdminId, adminUserId, reason || 'Revoked by Super Administrator');

      await createAuditLog({
        adminUserId,
        adminEmail,
        action: 'session.revoked_all',
        targetType: 'admin_user',
        targetId: targetAdminId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: currentSessionId,
        outcome: 'success',
        reason,
        newValue: { revokedCount, targetAdminEmail: targetAdmin.email },
      });

      return createSuccessResponse({ success: true, revokedCount });
    }
    
    if (revokeAll) {
      // Revoke all sessions except current
      revokedCount = await revokeAllSessionsExceptCurrent(
        adminUserId,
        currentSessionId,
        adminUserId,
        reason || 'Revoke all sessions'
      );
      
      await createAuditLog({
        adminUserId,
        adminEmail,
        action: 'session.revoked_all',
        targetType: 'admin_user',
        targetId: adminUserId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: currentSessionId,
        outcome: 'success',
        reason,
        newValue: { revokedCount },
      });
    } else if (sessionId) {
      // Revoke specific session
      // Check if user has permission to revoke this session
      const sessions = await getSessionsByAdminUserId(adminUserId);
      const targetSession = sessions.find(s => s.id === sessionId);
      
      if (!targetSession) {
        return createErrorResponse(
          'SESSION_NOT_FOUND',
          'Session not found',
          404,
          requestId
        );
      }
      
      // If not super admin, can only revoke own sessions
      if (role !== 'super_admin' && targetSession.adminUserId !== adminUserId) {
        return createErrorResponse(
          'PERMISSION_DENIED',
          'You can only revoke your own sessions',
          403,
          requestId
        );
      }
      
      // Cannot revoke current session
      if (sessionId === currentSessionId) {
        return createErrorResponse(
          'CANNOT_REVOKE_CURRENT',
          'Cannot revoke current session',
          400,
          requestId
        );
      }
      
      const revoked = await revokeSession(sessionId, adminUserId, reason);
      
      if (revoked) {
        revokedCount = 1;
        
        await createAuditLog({
          adminUserId,
          adminEmail,
          action: 'session.revoked',
          targetType: 'session',
          targetId: sessionId,
          requestId,
          ipAddress: authResult.context!.ipAddress,
          sessionId: currentSessionId,
          outcome: 'success',
          reason,
        });
      }
    } else {
      return createErrorResponse(
        'INVALID_INPUT',
        'Either sessionId or revokeAll must be provided',
        400,
        requestId
      );
    }
    
    return createSuccessResponse({
      success: true,
      revokedCount,
    });
  } catch (error) {
    console.error('Revoke session error:', error, requestId);
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while revoking session',
      500,
      requestId
    );
  }
}
