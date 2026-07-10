import { NextRequest } from "next/server";
import {
  requireAuth,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/middleware";
import { clearPendingMFASecret } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (!authResult.success) {
    return createErrorResponse(
      authResult.error!.code,
      authResult.error!.message,
      401,
      authResult.context?.requestId,
    );
  }

  const { adminUserId, adminEmail, requestId } = authResult.context!;

  try {
    await clearPendingMFASecret(adminUserId);

    await createAuditLog({
      adminUserId,
      adminEmail,
      action: "auth.mfa.setup_cancelled",
      targetType: "admin_user",
      targetId: adminUserId,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: "success",
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error("MFA setup cancel error:", error, requestId);

    return createErrorResponse(
      "INTERNAL_ERROR",
      "An error occurred while cancelling MFA setup",
      500,
      requestId,
    );
  }
}
