"use client";

// ==============================================================================
// 📝 FARMER REGISTRATION VIEW COMPONENT
// ==============================================================================
// Route URL: /register
// App Router Entry: src/app/register/page.tsx
// Description: Simple farmer sign-up (name, email, password). Phone/state/
// location aren't collected here — every new account is routed to /profile
// right after signing up to fill those in (see auth flow docs in EXPLAIN.md).
// ==============================================================================

import Link from "next/link";
import { Sprout, ArrowRight, AlertCircle } from "lucide-react";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile, getStoredProfile } from "@/lib/stores/farmStore";
import { register, login, getCurrentUser, AuthError } from "@/lib/auth/auth-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const GOOGLE_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      await login(email.trim(), password);
      const existing = getStoredProfile();
      saveProfile({ ...existing, name: name.trim() || existing.name });

      const user = await getCurrentUser();
      router.push(user && !user.profile_complete ? "/profile?complete=1" : "/dashboard");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const handleGoogleSuccess = useCallback(async () => {
    const user = await getCurrentUser();
    if (user?.full_name) {
      const existing = getStoredProfile();
      saveProfile({ ...existing, name: user.full_name });
    }
    router.push(user && !user.profile_complete ? "/profile?complete=1" : "/dashboard");
  }, [router]);

  const handleGoogleError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <div className="min-h-screen bg-farm-sand flex items-center justify-center p-4" data-theme="light">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 bg-farm-green rounded-xl flex items-center justify-center shadow-card">
            <Sprout className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl text-farm-dark">
            Fasal<span className="text-farm-green">Setu</span>
          </span>
        </Link>

        <div className="bg-white rounded-2xl shadow-card border border-farm-border-color p-8">
          <h1 className="text-2xl font-bold text-farm-dark mb-1">Create your account</h1>
          <p className="text-farm-muted text-sm mb-6">
            Smart farming intelligence for your fields. You'll finish setting up your profile
            (phone, state, etc.) right after this.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="reg-name">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2.5 border border-farm-border-color rounded-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="reg-email">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-farm-border-color rounded-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-2.5 border border-farm-border-color rounded-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green"
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
              {submitting ? "Creating account..." : "Create Account"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {GOOGLE_ENABLED && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-farm-border-color" />
                <span className="text-xs text-farm-muted font-medium">OR</span>
                <div className="flex-1 h-px bg-farm-border-color" />
              </div>

              <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
            </>
          )}
        </div>

        <p className="text-center text-sm text-farm-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-farm-green font-semibold hover:underline">
            Log in to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
