import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse, createSuccessResponse, extractPaginationParams } from '@/lib/middleware';
import {
  getAllAdminUsers,
  createAdminUser,
  updateAdminUser,
  disableAdminUser,
  enableAdminUser,
  getAdminUserById,
} from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// GET - List all admin users
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request, 'admins.view');
  
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
    const users = await getAllAdminUsers();
    
    // Log access
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: 'admin.viewed',
      targetType: 'admin_user',
      targetId: null,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: 'success',
    });
    
    return createSuccessResponse({
      users,
    });
  } catch (error) {
    console.error('Get users error:', error, requestId);
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while fetching admin users',
      500,
      requestId
    );
  }
}

// POST - Create new admin user
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, 'admins.create');
  
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
    const body = await request.json();
    const { email, name, role, password } = body;
    
    // Validate input
    if (!email || !name || !role || !password) {
      return createErrorResponse(
        'INVALID_INPUT',
        'Email, name, role, and password are required',
        400,
        requestId
      );
    }
    
    // Validate password length
    if (password.length < 12) {
      return createErrorResponse(
        'INVALID_PASSWORD',
        'Password must be at least 12 characters long',
        400,
        requestId
      );
    }
    
    // Validate role
    const validRoles = ['super_admin', 'moderator', 'support_agent', 'operations_admin', 'analyst'];
    if (!validRoles.includes(role)) {
      return createErrorResponse(
        'INVALID_ROLE',
        'Invalid role specified',
        400,
        requestId
      );
    }
    
    // Create admin user
    const newUser = await createAdminUser({
      email,
      name,
      role,
      password,
      createdBy: adminUserId,
    });
    
    // Log creation
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: 'admin.created',
      targetType: 'admin_user',
      targetId: newUser.id,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: 'success',
      newValue: { email, name, role },
    });
    
    return createSuccessResponse({
      user: newUser,
    }, 201);
  } catch (error: any) {
    console.error('Create user error:', error, requestId);
    
    if (error.message === 'Email already exists') {
      return createErrorResponse(
        'EMAIL_EXISTS',
        'An admin with this email already exists',
        409,
        requestId
      );
    }
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while creating admin user',
      500,
      requestId
    );
  }
}

// PATCH - Update admin user (role or status)
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request, 'admins.edit');
  
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      authResult.error!.code === 'PERMISSION_DENIED' ? 403 : 401,
      authResult.context?.requestId
    );
  }
  
  const { adminUserId, adminEmail, role: currentRole, requestId } = authResult.context!;
  
  try {
    const body = await request.json();
    const { targetUserId, role, status, reason } = body;
    
    // Validate input
    if (!targetUserId) {
      return createErrorResponse(
        'INVALID_INPUT',
        'targetUserId is required',
        400,
        requestId
      );
    }
    
    if (!role && !status) {
      return createErrorResponse(
        'INVALID_INPUT',
        'Either role or status must be provided',
        400,
        requestId
      );
    }
    
    // Check if trying to modify own account
    if (targetUserId === adminUserId) {
      await createAuditLog({
        adminUserId,
        adminEmail,
        action: 'permission.denied',
        targetType: 'admin_user',
        targetId: targetUserId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: authResult.context!.sessionId,
        outcome: 'denied',
        newValue: { reason: 'Self-modification attempt' },
      });
      
      return createErrorResponse(
        'SELF_MODIFICATION',
        'You cannot modify your own account',
        403,
        requestId
      );
    }
    
    // Get target user
    const targetUser = await getAdminUserById(targetUserId);
    if (!targetUser) {
      return createErrorResponse(
        'USER_NOT_FOUND',
        'Target admin user not found',
        404,
        requestId
      );
    }
    
    // Handle status changes (disable/enable)
    if (status === 'disabled') {
      await disableAdminUser(targetUserId);
      
      await createAuditLog({
        adminUserId,
        adminEmail,
        action: 'admin.disabled',
        targetType: 'admin_user',
        targetId: targetUserId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: authResult.context!.sessionId,
        outcome: 'success',
        reason,
        previousValue: { status: targetUser.status },
        newValue: { status: 'disabled' },
      });
      
      return createSuccessResponse({
        success: true,
      });
    }
    
    if (status === 'active') {
      await enableAdminUser(targetUserId);
      
      await createAuditLog({
        adminUserId,
        adminEmail,
        action: 'admin.enabled',
        targetType: 'admin_user',
        targetId: targetUserId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: authResult.context!.sessionId,
        outcome: 'success',
        reason,
        previousValue: { status: targetUser.status },
        newValue: { status: 'active' },
      });
      
      return createSuccessResponse({
        success: true,
      });
    }
    
    // Handle role changes
    if (role) {
      const validRoles = ['super_admin', 'moderator', 'support_agent', 'operations_admin', 'analyst'];
      if (!validRoles.includes(role)) {
        return createErrorResponse(
          'INVALID_ROLE',
          'Invalid role specified',
          400,
          requestId
        );
      }
      
      const updatedUser = await updateAdminUser(targetUserId, { role }, requestId);
      
      await createAuditLog({
        adminUserId,
        adminEmail,
        action: 'admin.role_changed',
        targetType: 'admin_user',
        targetId: targetUserId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: authResult.context!.sessionId,
        outcome: 'success',
        reason,
        previousValue: { role: targetUser.role },
        newValue: { role },
      });
      
      return createSuccessResponse({
        user: updatedUser,
      });
    }
    
    return createErrorResponse(
      'INVALID_INPUT',
      'Invalid update parameters',
      400,
      requestId
    );
  } catch (error) {
    console.error('Update user error:', error, requestId);
    
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An error occurred while updating admin user',
      500,
      requestId
    );
  }
}
