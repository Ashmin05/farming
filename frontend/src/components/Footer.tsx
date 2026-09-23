import Link from "next/link";
import { Sprout } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "Satellite Monitoring", href: "/satellite" },
    { label: "Weather Alerts", href: "/weather" },
    { label: "AI Assistant (KrishiBot)", href: "/ai-chat" },
    { label: "Farmer Login", href: "/login" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
  ],
  Support: [
    { label: "Help Center", href: "/help" },
    { label: "Contact Us", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

const crops = ["Rice", "Wheat", "Onion", "Tomato", "Sugarcane"];

export default function Footer() {
  return (
    <footer className="bg-farm-dark text-white">
      {/* Crops marquee band */}
      <div className="bg-farm-green py-4 overflow-hidden">
        <div className="flex gap-6 whitespace-nowrap" style={{ animation: "marquee 20s linear infinite" }}>
          {[...crops, ...crops].map((c, i) => (
            <span key={i} className="text-white/90 text-sm font-medium flex-shrink-0">
              🌾 {c}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-farm-green rounded-lg flex items-center justify-center">
                <Sprout className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl">
                Fasal<span className="text-farm-green-mid">Setu</span>
              </span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Empowering Indian farmers with satellite intelligence, AI-driven advice,
              and real-time crop insights — in your own language.
            </p>
            <div className="flex gap-3 mt-6">
              {[
                { label: "𝕏", href: "#" },
                { label: "f", href: "#" },
                { label: "▶", href: "#" },
                { label: "📷", href: "#" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-farm-green transition-colors text-white/80 text-sm font-bold"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="font-semibold text-white/90 mb-4 text-sm uppercase tracking-wider">{group}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-white/55 text-sm hover:text-white transition-colors hover:underline underline-offset-2"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="text-white/40 text-sm">© 2026 FasalSetu. Built with ❤️ for Indian farmers.</p>
            <p className="text-white/30 text-xs">Created by Team Necxtron</p>
          </div>
          <p className="text-white/40 text-sm">🇮🇳 FasalSetu – Smart Agriculture</p>
        </div>
      </div>
    </footer>
  );
}
