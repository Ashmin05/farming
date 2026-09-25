"use client";

// ==============================================================================
// 📝 FARMER REGISTRATION VIEW COMPONENT
// ==============================================================================
// Route URL: /register
// App Router Entry: src/app/register/page.tsx
// Description: Farmer registration onboarding page collecting name, mobile number,
// state, primary supported crop, and preferred language (English, Bengali, Hindi).
// ==============================================================================

import Link from "next/link";
import { Sprout, ArrowRight, AlertCircle } from "lucide-react";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/lib/stores/farmStore";
import { register, login, getCurrentUser, AuthError } from "@/lib/auth/auth-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const languages = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "hi", label: "हिंदी (Hindi)" },
];

const GOOGLE_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [lang, setLang] = useState("en");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined, {
        phone: phone.trim() || undefined,
        state,
      });
      await login(email.trim(), password);
      saveProfile({
        name: name.trim() || "Farmer",
        phone: phone.trim(),
        state,
        location: "",
        preferredLanguage: lang,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const handleGoogleSuccess = useCallback(async () => {
    const user = await getCurrentUser();
    saveProfile({
      name: user?.full_name?.trim() || "Farmer",
      phone: phone.trim(),
      state,
      location: "",
      preferredLanguage: lang,
    });
    router.push(user && !user.profile_complete ? "/profile?complete=1" : "/dashboard");
  }, [router, phone, state, lang]);

  const handleGoogleError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <div className="min-h-screen bg-farm-sand flex items-center justify-center p-4" data-theme="light">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 bg-farm-green rounded-xl flex items-center justify-center shadow-card">
            <Sprout className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl text-farm-dark">
            Fasal<span className="text-farm-green">Setu</span>
          </span>
        </Link>

        <div className="bg-white rounded-2xl shadow-card border border-farm-border-color p-8">
          <h1 className="text-2xl font-bold text-farm-dark mb-1">Create farmer account</h1>
          <p className="text-farm-muted text-sm mb-6">Smart farming intelligence for your fields</p>

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
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="reg-phone">
                Mobile Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-farm-gray border border-r-0 border-farm-border-color rounded-l-lg text-farm-muted text-sm font-medium">
                  +91
                </span>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 px-4 py-2.5 border border-farm-border-color rounded-r-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green bg-white"
                />
              </div>
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
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="reg-state">
                State
              </label>
              <select
                id="reg-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2.5 border border-farm-border-color rounded-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green bg-white text-farm-dark font-medium"
              >
                {["Maharashtra", "Punjab", "Uttar Pradesh", "Madhya Pradesh", "Rajasthan", "Bihar", "Haryana", "West Bengal", "Odisha", "Gujarat"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5">
                Preferred Language
              </label>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((item) => (
                  <label
                    key={item.code}
                    className={`flex flex-col items-center justify-center p-2.5 border rounded-lg cursor-pointer text-center transition-all ${lang === item.code ? "border-farm-green bg-farm-green-light" : "border-farm-border-color hover:border-farm-green"
                      }`}
                  >
                    <input
                      type="radio"
                      name="language"
                      value={item.code}
                      checked={lang === item.code}
                      onChange={() => setLang(item.code)}
                      className="sr-only"
                    />
                    <span className="text-xs font-semibold text-farm-dark">{item.label}</span>
                  </label>
                ))}
              </div>
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
