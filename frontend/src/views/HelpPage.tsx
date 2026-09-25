import Link from "next/link";

// ==============================================================================
// ❓ HELP CENTER VIEW COMPONENT
// ==============================================================================
// Route URL: /help
// App Router Entry: src/app/help/page.tsx
// Description: Farmer help center with FAQ topics (getting started, satellite & NDVI,
// AI assistant, and direct support contact).
// ==============================================================================

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LifeBuoy, MessageCircle, BookOpen, Phone, ArrowRight } from "lucide-react";

const topics = [
  { icon: BookOpen, title: "Getting Started", desc: "Setup your account, add your farm, and map your first field.", href: "#" },
  { icon: LifeBuoy, title: "Satellite & NDVI", desc: "Understanding your crop health maps and NDVI scores.", href: "#" },
  { icon: MessageCircle, title: "AI Assistant", desc: "How to ask KrishiBot and get the best answers.", href: "#" },
  { icon: Phone, title: "Contact Support", desc: "Talk to our team via phone or email.", href: "#" },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white" data-theme="light">
      <Navbar />
      <div className="pt-24 pb-14 bg-farm-green-light border-b border-farm-border-color text-center">
        <h1 className="text-4xl font-bold text-farm-dark mb-3">Help Center</h1>
        <p className="text-farm-muted max-w-md mx-auto">Find answers, guides, and contact options below.</p>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {topics.map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href} className="group p-6 rounded-2xl border border-farm-border-color hover:shadow-card-hover hover:border-farm-green transition-all">
              <div className="w-11 h-11 bg-farm-green-light rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-farm-green" />
              </div>
              <h3 className="font-bold text-farm-dark mb-2 group-hover:text-farm-green transition-colors">{title}</h3>
              <p className="text-farm-muted text-sm">{desc}</p>
              <div className="mt-3 flex items-center gap-1 text-farm-green text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 bg-farm-sand rounded-2xl p-8 text-center border border-farm-border-color">
          <h2 className="text-xl font-bold text-farm-dark mb-2">Need more help?</h2>
          <p className="text-farm-muted text-sm mb-4">Chat with our agronomists in your language — Mon to Sat, 7am to 8pm</p>
          <a href="mailto:support@fasalsetu.in" className="inline-flex items-center gap-2 bg-farm-green text-white px-6 py-3 rounded-xl font-semibold hover:bg-farm-green-dark transition-all">
            📧 Email Support
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
