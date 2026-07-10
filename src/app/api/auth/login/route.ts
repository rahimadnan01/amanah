import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createToken,
  verifyMFACode,
  normalizeMFACode,
} from "@/lib/auth";
import { getCookieOptions } from "@/lib/auth-edge";
import {
  getAdminUserByEmail,
  incrementFailedLoginAttempts,
  resetFailedLoginAttempts,
  updateLastLogin,
  createSession,
  updateSessionToken,
} from "@/lib/db";
import {
  createAuditLog,
  generateRequestId,
  extractIPAddress,
} from "@/lib/audit";

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const ipAddress = extractIPAddress(request.headers);

  try {
    const body = await request.json();
    const { email, password, mfaCode } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Email and password are required",
          },
          requestId,
        },
        { status: 400 },
      );
    }

    // Get admin user
    const adminUser = await getAdminUserByEmail(email);

    if (!adminUser) {
      // Log failed attempt even for non-existent user (security by obscurity)
      await createAuditLog({
        adminUserId: "unknown",
        adminEmail: email,
        action: "auth.login.failed",
        targetType: "admin_user",
        targetId: null,
        requestId,
        ipAddress,
        sessionId: null,
        outcome: "failure",
        newValue: { reason: "User not found" },
      });

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
          requestId,
        },
        { status: 401 },
      );
    }

    // Check if account is disabled
    if (adminUser.status === "disabled") {
      await createAuditLog({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "auth.login.failed",
        targetType: "admin_user",
        targetId: adminUser.id,
        requestId,
        ipAddress,
        sessionId: null,
        outcome: "failure",
        newValue: { reason: "Account disabled" },
      });

      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_DISABLED",
            message: "Account has been disabled",
          },
          requestId,
        },
        { status: 403 },
      );
    }

    // Check if account is locked
    if (adminUser.status === "locked") {
      const lockedUntil = adminUser.lockedUntil
        ? new Date(adminUser.lockedUntil)
        : null;
      if (lockedUntil && lockedUntil > new Date()) {
        await createAuditLog({
          adminUserId: adminUser.id,
          adminEmail: adminUser.email,
          action: "auth.login.account_locked",
          targetType: "admin_user",
          targetId: adminUser.id,
          requestId,
          ipAddress,
          sessionId: null,
          outcome: "failure",
          newValue: { lockedUntil: adminUser.lockedUntil },
        });

        return NextResponse.json(
          {
            error: {
              code: "ACCOUNT_LOCKED",
              message:
                "Account is temporarily locked due to too many failed login attempts",
            },
            requestId,
          },
          { status: 429 },
        );
      } else {
        // Lock has expired, reset status
        await resetFailedLoginAttempts(email);
      }
    }

    // Verify password
    const passwordValid = await verifyPassword(
      password,
      adminUser.passwordHash,
    );

    if (!passwordValid) {
      await incrementFailedLoginAttempts(email);

      await createAuditLog({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "auth.login.failed",
        targetType: "admin_user",
        targetId: adminUser.id,
        requestId,
        ipAddress,
        sessionId: null,
        outcome: "failure",
        newValue: {
          reason: "Invalid password",
          failedAttempts: adminUser.failedLoginAttempts + 1,
        },
      });

      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
          requestId,
        },
        { status: 401 },
      );
    }

    // If MFA is enabled, check if MFA code is provided
    if (adminUser.mfaEnabled) {
      if (!mfaCode) {
        // Return that MFA is required without creating session
        return NextResponse.json(
          {
            requiresMFA: true,
            requestId,
          },
          { status: 200 },
        );
      }

      const normalizedMfaCode = normalizeMFACode(mfaCode);

      // Verify MFA code
      if (!adminUser.mfaSecret) {
        return NextResponse.json(
          {
            error: {
              code: "MFA_NOT_CONFIGURED",
              message: "MFA is enabled but not configured",
            },
            requestId,
          },
          { status: 500 },
        );
      }

      const mfaValid = verifyMFACode(adminUser.mfaSecret, normalizedMfaCode);

      if (!mfaValid) {
        await createAuditLog({
          adminUserId: adminUser.id,
          adminEmail: adminUser.email,
          action: "auth.mfa.failed",
          targetType: "admin_user",
          targetId: adminUser.id,
          requestId,
          ipAddress,
          sessionId: null,
          outcome: "failure",
          newValue: { reason: "Invalid MFA code" },
        });

        return NextResponse.json(
          {
            error: {
              code: "INVALID_MFA_CODE",
              message: "Invalid MFA code",
            },
            requestId,
          },
          { status: 401 },
        );
      }

      // Log successful MFA verification
      await createAuditLog({
        adminUserId: adminUser.id,
        adminEmail: adminUser.email,
        action: "auth.mfa.verified",
        targetType: "admin_user",
        targetId: adminUser.id,
        requestId,
        ipAddress,
        sessionId: null,
        outcome: "success",
      });
    }

    // Reset failed login attempts on successful login
    await resetFailedLoginAttempts(email);

    // Update last login time
    await updateLastLogin(adminUser.id);

    // Get user agent
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Create session
    const token = await createToken({
      adminUserId: adminUser.id,
      sessionId: "", // Will be filled after session creation
      email: adminUser.email,
      role: adminUser.role,
    });

    const session = await createSession({
      adminUserId: adminUser.id,
      token,
      ipAddress,
      userAgent,
    });

    // Recreate token with session ID
    const finalToken = await createToken({
      adminUserId: adminUser.id,
      sessionId: session.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    // Update session with new token
    // Note: In a real DB we'd update the token, but for JSON file we'll just use the new one
    // The session lookup will use the token from the cookie
    await updateSessionToken(session.id, finalToken);

    // Log successful login
    await createAuditLog({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: "auth.login.success",
      targetType: "session",
      targetId: session.id,
      requestId,
      ipAddress,
      sessionId: session.id,
      outcome: "success",
      newValue: { userAgent },
    });

    // Set cookie
    const cookieOptions = getCookieOptions();
    const response = NextResponse.json(
      {
        success: true,
        requestId,
      },
      { status: 200 },
    );

    response.cookies.set(cookieOptions.name, finalToken, cookieOptions.options);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred during login",
        },
        requestId,
      },
      { status: 500 },
    );
  }
}
