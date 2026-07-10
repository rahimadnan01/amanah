"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MFAState = "not-started" | "qr-code" | "verify" | "done";

export default function MFASetupPage() {
  const router = useRouter();
  const [state, setState] = useState<MFAState>("not-started");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartSetup = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/mfa/setup");
      const data = await response.json();

      if (response.ok) {
        setQrCode(data.qrCode);
        setState("qr-code");
      } else {
        setError(data.error?.message || "Failed to start MFA setup");
      }
    } catch (error) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (response.ok) {
        setState("done");
      } else {
        setError(data.error?.message || "Verification failed");
      }
    } catch (error) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToQR = () => {
    setState("qr-code");
    setCode("");
    setError("");
  };

  const handleCancelSetup = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/mfa/setup/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (response.ok) {
        setState("not-started");
        setQrCode("");
        setCode("");
      } else {
        setError(data.error?.message || "Failed to cancel MFA setup");
      }
    } catch (error) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    router.push("/dashboard");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Multi-Factor Authentication Setup
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* State 1: Not Started */}
      {state === "not-started" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">What is MFA?</h2>
          <p className="text-gray-600 mb-4">
            Multi-factor authentication (MFA) adds an extra layer of security to
            your account. When you log in, you'll need to enter a code from an
            authenticator app on your phone in addition to your password.
          </p>
          <p className="text-gray-600 mb-6">
            We recommend using Google Authenticator, Authy, or any other
            TOTP-compatible authenticator app.
          </p>
          <button
            onClick={handleStartSetup}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Start Setup"}
          </button>
        </div>
      )}

      {/* State 2: QR Code */}
      {state === "qr-code" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Scan the QR Code</h2>
          <p className="text-gray-600 mb-4">
            Use your authenticator app to scan this QR code.
          </p>
          {qrCode && (
            <div className="flex justify-center mb-6">
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4 text-center">
            Can't scan? Contact your administrator for assistance.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setState("verify")}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              I've scanned the code
            </button>
            <button
              onClick={handleCancelSetup}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel setup
            </button>
          </div>
        </div>
      )}

      {/* State 3: Verify */}
      {state === "verify" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Enter Verification Code
          </h2>
          <p className="text-gray-600 mb-4">
            Enter the 6-digit code from your authenticator app to confirm MFA
            setup.
          </p>
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                maxLength={6}
                placeholder="123456"
                className="w-full px-3 py-2 border rounded-md text-center text-2xl tracking-widest"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm and Enable MFA"}
            </button>
            <button
              type="button"
              onClick={handleBackToQR}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back to QR code
            </button>
            <button
              type="button"
              onClick={handleCancelSetup}
              disabled={loading}
              className="w-full px-4 py-2 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel setup
            </button>
          </form>
        </div>
      )}

      {/* State 4: Done */}
      {state === "done" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              MFA Enabled Successfully!
            </h2>
            <p className="text-gray-600 mb-6">
              Your account is now protected with multi-factor authentication.
              You'll need to enter a code from your authenticator app each time
              you log in.
            </p>
            <button
              onClick={handleDone}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
