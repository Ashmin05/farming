"use client";

// ==============================================================================
// 🔑 FARMER LOGIN VIEW COMPONENT
// ==============================================================================
// Route URL: /login
// App Router Entry: src/app/login/page.tsx
// Description: Authentication screen for Indian farmers with phone number/password,
// multi-language greeting switcher.
// ==============================================================================

import { useState } from "react";
import Link from "next/link";
import { Sprout, ArrowRight, Globe } from "lucide-react";

const languages = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "hi", label: "हिंदी" },
];

export default function LoginPage() {
  const [lang, setLang] = useState("en");

  return (
    <div className="min-h-screen bg-farm-sand flex items-center justify-center p-4" data-theme="light">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 bg-farm-green rounded-xl flex items-center justify-center shadow-card">
            <Sprout className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl text-farm-dark">
            Fasal<span className="text-farm-green">Setu</span>
          </span>
        </Link>

        <div className="bg-white rounded-2xl shadow-card border border-farm-border-color p-8">
          {/* Language Switcher */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-farm-border-color">
            <span className="text-xs text-farm-muted flex items-center gap-1 font-medium">
              <Globe className="w-3 h-3" /> Language:
            </span>
            <div className="flex gap-1">
              {languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all ${lang === l.code ? "bg-farm-green text-white" : "text-farm-muted hover:text-farm-dark bg-farm-gray"
                    }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-farm-dark mb-1">
            {lang === "bn" ? "স্বাগতম" : lang === "hi" ? "वापसी पर स्वागत" : "Welcome back"}
          </h1>
          <p className="text-farm-muted text-sm mb-6">
            {lang === "bn"
              ? "আপনার কৃষি ড্যাশবোর্ডে সাইন ইন করুন"
              : lang === "hi"
                ? "अपने किसान डैशबोर्ड में साइन इन करें"
                : "Sign in to your farming dashboard"}
          </p>

          <form action="/dashboard" method="get" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="phone">
                Mobile Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-farm-gray border border-r-0 border-farm-border-color rounded-l-lg text-farm-muted text-sm font-medium">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  required
                  placeholder="9876543210"
                  className="flex-1 px-4 py-2.5 border border-farm-border-color rounded-r-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-farm-border-color rounded-lg text-sm focus:outline-none focus:border-farm-green focus:ring-1 focus:ring-farm-green"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-farm-muted cursor-pointer">
                <input type="checkbox" className="rounded border-farm-border-color text-farm-green focus:ring-farm-green" />
                Remember me
              </label>
              <a href="#" className="text-sm text-farm-green hover:underline font-medium">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-farm-green text-white py-3 rounded-xl font-semibold hover:bg-farm-green-dark transition-all duration-150 group shadow-sm hover:shadow-md"
            >
              Sign In to Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-farm-muted mt-6">
          New to FasalSetu?{" "}
          <Link href="/register" className="text-farm-green font-semibold hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
