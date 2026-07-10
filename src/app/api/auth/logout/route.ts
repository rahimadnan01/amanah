import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse } from '@/lib/middleware';
import { revokeSessionByToken } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  
  if (!authResult.success) {
    const response = createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      401,
      authResult.context?.requestId
    );
    
    // Clear cookie even on error
    response.cookies.delete('admin_session');
    return response;
  }
  
  const { adminUserId, adminEmail, sessionId, ipAddress, requestId } = authResult.context!;
  
  try {
    // Revoke the session
    const sessionToken = request.cookies.get('admin_session')?.value;
    if (sessionToken) {
      await revokeSessionByToken(sessionToken);
    }
    
    // Log logout
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: 'auth.logout',
      targetType: 'session',
      targetId: sessionId,
      requestId,
      ipAddress,
      sessionId,
      outcome: 'success',
    });
    
    // Clear cookie
    const response = NextResponse.json(
      {
        success: true,
        requestId,
      },
      { status: 200 }
    );
    
    response.cookies.delete('admin_session');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error, requestId);
    
    // Still clear cookie on error
    const response = createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred during logout',
      500,
      requestId
    );
    
    response.cookies.delete('admin_session');
    return response;
  }
}
