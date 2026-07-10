import { NextRequest } from 'next/server';
import { requireAuth, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { getAuditLogs } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// GET - List audit logs with filtering and pagination
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request, 'audit.view');
  
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      authResult.error!.code === 'PERMISSION_DENIED' ? 403 : 401,
      authResult.context?.requestId
    );
  }
  
  const { adminUserId, adminEmail, requestId } = authResult.context!;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || undefined;
    const adminUserIdFilter = searchParams.get('adminUserId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    
    const result = await getAuditLogs({
      action,
      adminUserId: adminUserIdFilter,
      fromDate,
      toDate,
      page,
      limit,
    });
    
    // Log that audit logs were viewed
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: 'audit.viewed',
      targetType: null,
      targetId: null,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: 'success',
      newValue: { filters: { action, adminUserId: adminUserIdFilter, fromDate, toDate } },
    });
    
    return createSuccessResponse(result);
  } catch (error) {
    console.error('Get audit logs error:', error, requestId);
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while fetching audit logs',
      500,
      requestId
    );
  }
}

// Note: No DELETE or PUT endpoints for audit logs - they are append-only (AUD-005)
