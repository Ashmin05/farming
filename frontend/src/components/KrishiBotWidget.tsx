"use client";

// ==============================================================================
// 🤖 KRISHIBOT AI FLOATING WIDGET
// ==============================================================================
// A floating circle button fixed to the bottom-right corner of every page.
// Clicking it opens a compact chat box. The "Open full page" link goes to /ai-chat.
// Used in: AppLayout and main Navbar layout pages via _layout or direct import.
// ==============================================================================

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Send, X, Sprout, Loader2, Maximize2, MessageSquare } from "lucide-react";
import { apiClient, type ChatMessage } from "@/lib/api";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Namaste! 🌾 I'm KrishiBot AI. Ask me about crop health, irrigation, pests, or market prices.",
  timestamp: new Date().toISOString(),
};

export default function KrishiBotWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiClient.sendChatMessage(msg, messages);
      if (res.ok) setMessages((prev) => [...prev, res.data]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); send(); }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat Box */}
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-farm-border-color overflow-hidden flex flex-col"
          style={{ height: "440px" }}>
          {/* Header */}
          <div className="bg-farm-green px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">KrishiBot AI</p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse inline-block" />
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href="/ai-chat"
                onClick={() => setOpen(false)}
                title="Open full KrishiBot AI page"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-farm-gray/30">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "bg-farm-green" : "bg-purple-100"}`}>
                  {msg.role === "assistant"
                    ? <Sprout className="w-3.5 h-3.5 text-white" />
                    : <span className="text-purple-700 text-xs font-bold">Y</span>}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === "user"
                    ? "bg-farm-green text-white rounded-tr-sm"
                    : "bg-white text-farm-dark rounded-tl-sm shadow-sm border border-farm-border-color"
                  }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-xl bg-farm-green flex items-center justify-center flex-shrink-0">
                  <Sprout className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5 text-farm-muted border border-farm-border-color shadow-sm">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">KrishiBot AI is thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 bg-white border-t border-farm-border-color">
              <p className="text-xs text-farm-muted mt-2 mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Quick questions:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Yellow leaves on wheat?", "Rice water schedule?", "Onion pest control?"].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs bg-farm-green-light border border-farm-border-color px-2 py-1 rounded-full text-farm-dark hover:border-farm-green hover:text-farm-green transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 p-3 bg-white border-t border-farm-border-color">
            <div className="flex gap-2 items-center bg-farm-gray rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-farm-green focus-within:bg-white transition-all">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask KrishiBot AI…"
                className="flex-1 text-xs text-farm-dark placeholder-farm-muted bg-transparent focus:outline-none"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 bg-farm-green rounded-lg flex items-center justify-center text-white hover:bg-farm-green-dark transition-all disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Circle Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        title="KrishiBot AI Assistant"
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 ${open
            ? "bg-farm-dark text-white rotate-0"
            : "bg-farm-green text-white"
          }`}
      >
        {open ? <X className="w-5 h-5" /> : <Brain className="w-6 h-6" />}
      </button>
    </div>
  );
}
