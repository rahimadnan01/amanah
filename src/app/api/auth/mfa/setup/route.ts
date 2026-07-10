import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/middleware";
import {
  generateMFASecret,
  getOTPAuthURL,
  generateQRCodeDataURL,
  verifyMFACode,
  normalizeMFACode,
} from "@/lib/auth";
import {
  enableMFA,
  getAdminUserById,
  setPendingMFASecret,
  clearPendingMFASecret,
} from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

// GET - Generate MFA secret and QR code
export async function GET(request: NextRequest) {
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
    // Check if MFA is already enabled
    const adminUser = await getAdminUserById(adminUserId);
    if (!adminUser) {
      return createErrorResponse(
        "USER_NOT_FOUND",
        "Admin user not found",
        404,
        requestId,
      );
    }

    if (adminUser.mfaEnabled) {
      return createErrorResponse(
        "MFA_ALREADY_ENABLED",
        "MFA is already enabled for this account",
        400,
        requestId,
      );
    }

    let secretToUse = adminUser.pendingMfaSecret;
    let qrCodeUrl = "";

    if (secretToUse) {
      qrCodeUrl = getOTPAuthURL(secretToUse);
    } else {
      const generated = generateMFASecret();
      secretToUse = generated.secret;
      qrCodeUrl = generated.qrCode;
      await setPendingMFASecret(adminUserId, secretToUse);
    }

    // Generate QR code as base64
    const qrCodeDataURL = await generateQRCodeDataURL(qrCodeUrl);

    // Log MFA setup started
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: "auth.mfa.setup_started",
      targetType: "admin_user",
      targetId: adminUserId,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: "success",
    });

    return createSuccessResponse({
      qrCode: qrCodeDataURL,
      // secret intentionally omitted — QR code is sufficient
    });
  } catch (error) {
    console.error("MFA setup GET error:", error, requestId);

    return createErrorResponse(
      "INTERNAL_ERROR",
      "An error occurred while generating MFA setup data",
      500,
      requestId,
    );
  }
}

// POST - Verify MFA code and enable MFA
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
    const body = await request.json();
    const code = normalizeMFACode(body?.code);

    console.log("MFA verify request received:", {
      code: code ? "[PRESENT]" : "[MISSING]",
      rawCode: String(body?.code),
      requestPayload: body,
      serverTime: new Date().toISOString(),
    });

    // Check if MFA is already enabled
    const adminUser = await getAdminUserById(adminUserId);
    if (!adminUser) {
      return createErrorResponse(
        "USER_NOT_FOUND",
        "Admin user not found",
        404,
        requestId,
      );
    }

    if (adminUser.mfaEnabled) {
      return createErrorResponse(
        "MFA_ALREADY_ENABLED",
        "MFA is already enabled for this account",
        400,
        requestId,
      );
    }

    const pendingSecret = adminUser.pendingMfaSecret;

    console.log("MFA verify secret comparison:", {
      hasPendingSecret: !!pendingSecret,
      storedPendingSecretLength: pendingSecret?.length ?? 0,
    });

    // Validate input
    if (!pendingSecret || !code) {
      console.error("MFA validation failed - pending secret or code missing", {
        hasPendingSecret: !!pendingSecret,
        hasCode: !!code,
      });
      return createErrorResponse(
        "INVALID_INPUT",
        "Please restart MFA setup and try again",
        400,
        requestId,
      );
    }

    // Verify the code
    const isValid = verifyMFACode(pendingSecret, code);

    if (!isValid) {
      console.error("MFA verification failed - invalid code", {
        hasPendingSecret: !!pendingSecret,
        code,
      });
      await createAuditLog({
        adminUserId,
        adminEmail,
        action: "auth.mfa.failed",
        targetType: "admin_user",
        targetId: adminUserId,
        requestId,
        ipAddress: authResult.context!.ipAddress,
        sessionId: authResult.context!.sessionId,
        outcome: "failure",
        newValue: { reason: "Invalid verification code during setup" },
      });

      return createErrorResponse(
        "INVALID_CODE",
        "Invalid verification code",
        400,
        requestId,
      );
    }

    // Enable MFA
    await enableMFA(adminUserId, pendingSecret);

    // Log MFA enabled
    await createAuditLog({
      adminUserId,
      adminEmail,
      action: "auth.mfa.enabled",
      targetType: "admin_user",
      targetId: adminUserId,
      requestId,
      ipAddress: authResult.context!.ipAddress,
      sessionId: authResult.context!.sessionId,
      outcome: "success",
    });

    return createSuccessResponse({
      success: true,
    });
  } catch (error) {
    console.error("MFA setup POST error:", error, requestId);

    return createErrorResponse(
      "INTERNAL_ERROR",
      "An error occurred while enabling MFA",
      500,
      requestId,
    );
  }
}
