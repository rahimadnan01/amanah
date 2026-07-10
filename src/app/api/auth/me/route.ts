import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse, createSuccessResponse } from '@/lib/middleware';
import { getAdminUserById, getRolePermissions } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      401,
      authResult.context?.requestId
    );
  }
  
  const { adminUserId, adminEmail, role, requestId } = authResult.context!;
  
  try {
    // Get admin user details (without sensitive data)
    const adminUser = await getAdminUserById(adminUserId);
    if (!adminUser) {
      return createErrorResponse(
        'USER_NOT_FOUND',
        'Admin user not found',
        404,
        requestId
      );
    }
    
    // Get permissions for this role
    const permissions = await getRolePermissions(role);
    
    // Log access
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: 'admin.viewed',
      targetType: 'admin_user',
      targetId: adminUserId,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: 'success',
    });
    
    return createSuccessResponse({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      status: adminUser.status,
      mfaEnabled: adminUser.mfaEnabled,
      createdAt: adminUser.createdAt,
      lastLoginAt: adminUser.lastLoginAt,
      permissions,
    });
  } catch (error) {
    console.error('Get me error:', error, requestId);
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while fetching user data',
      500,
      requestId
    );
  }
}
