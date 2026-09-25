"use client";

// ==============================================================================
// 🔑 FORGOT PASSWORD VIEW COMPONENT
// ==============================================================================
// Route URL: /forgot-password
// Requests a password reset link for an email/password account.
//
// DEV NOTE: this project has no email-sending service configured yet (see
// EXPLAIN.md). In development, the backend returns the reset token directly
// in the response so this demo can complete end-to-end without real email
// delivery — that dev_reset_token is shown on screen here, clearly labeled.
// In production the backend never returns it; a real email integration would
// need to be added to send the link instead.
// ==============================================================================

import { useState } from "react";
import Link from "next/link";
import { Sprout, ArrowRight, AlertCircle, Mail } from "lucide-react";
import { forgotPassword, AuthError } from "@/lib/auth/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
      setDevResetLink(
        result.devResetToken
          ? `/reset-password?token=${encodeURIComponent(result.devResetToken)}`
          : null
      );
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-farm-sand flex items-center justify-center p-4" data-theme="light">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 bg-farm-green rounded-xl flex items-center justify-center shadow-card">
            <Sprout className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl text-farm-dark">
            Fasal<span className="text-farm-green">Setu</span>
          </span>
        </Link>

        <div className="bg-white rounded-2xl shadow-card border border-farm-border-color p-8">
          <h1 className="text-2xl font-bold text-farm-dark mb-1">Forgot password?</h1>
          <p className="text-farm-muted text-sm mb-6">
            Enter your email and we'll help you reset it.
          </p>

          {message ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
              {devResetLink && (
                <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                  <p className="font-semibold mb-1">Dev mode — no email service configured:</p>
                  <Link href={devResetLink} className="text-farm-green underline break-all">
                    {typeof window !== "undefined" ? `${window.location.origin}${devResetLink}` : devResetLink}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-farm-border-color rounded-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green bg-white"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-farm-green text-white py-3 rounded-xl font-semibold hover:bg-farm-green-dark transition-all duration-150 group shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send Reset Link"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-farm-muted mt-6">
          Remembered it?{" "}
          <Link href="/login" className="text-farm-green font-semibold hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
