"use client";
import { Sparkles } from "@/components/ui/sparkles";
import { ArrowRight, Github, Twitter, Disc, CheckCircle, Terminal, Command } from "lucide-react";
import PricingSection6 from "@/components/ui/pricing-section-4";
import { FeaturesSection } from "@/components/ui/features-section";
import { RoadmapSection } from "@/components/ui/roadmap-section";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center ring-1 ring-primary/50">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-white">Seamless AI</span>
      </div>
      <div className="hidden md:flex items-center gap-6">
        <Link href="#features" className="text-sm text-neutral-400 hover:text-white transition-colors">Features</Link>
        <Link href="#roadmap" className="text-sm text-neutral-400 hover:text-white transition-colors">Roadmap</Link>
        <Link href="#pricing" className="text-sm text-neutral-400 hover:text-white transition-colors">Pricing</Link>
      </div>
      <div className="flex items-center gap-4">
        <Link href="https://github.com/seamless-ai" target="_blank" className="text-neutral-400 hover:text-white transition-colors">
          <Github className="w-5 h-5" />
        </Link>
        <button className="h-8 px-4 bg-white text-black rounded-lg text-xs font-medium hover:bg-neutral-200 transition-colors">
          Get Started
        </button>
      </div>
    </div>
  </nav>
);

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden min-h-screen flex flex-col justify-center">
      <div className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>

      <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-neutral-400 backdrop-blur-sm"
        >
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
          <span>v2.0 is now available publicly</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-6xl md:text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-white/50"
        >
          Ship Faster And <br />
          Launch Faster
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed"
        >
          The AI-powered code editor that understands your project. Write, refactor, and debug with unprecedented speed and accuracy purely on your local machine.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
        >
          <button className="h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2 shadow-[0_0_20px_-5px_var(--color-primary)] w-full sm:w-auto justify-center">
            Start Coding Free
            <ArrowRight className="w-4 h-4" />
          </button>
          <button className="h-12 px-8 border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2 text-neutral-300 w-full sm:w-auto justify-center">
            <Terminal className="w-4 h-4" />
            Download for Mac
          </button>
        </motion.div>

        {/* App Screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 rounded-xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl max-w-5xl mx-auto overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white/10 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10 pointer-events-none" />

          <img
            src="/app-screenshot.png"
            alt="Seamless AI Interface"
            className="w-full h-auto rounded-tl-lg rounded-tr-lg opacity-90 hover:opacity-100 transition-opacity duration-500"
          />
        </motion.div>
      </div>
    </section>
  );
}

const SocialProof = () => (
  <section className="py-10 border-y border-white/5 bg-white/[0.02]">
    <div className="max-w-7xl mx-auto px-6 text-center">
      <p className="text-sm font-medium text-neutral-500 mb-8">TRUSTED BY INNOVATIVE TEAMS WORLDWIDE</p>
      <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
        {/* Placeholder Logos */}
        <div className="flex items-center gap-2 text-xl font-bold font-mono"><Command className="w-6 h-6" /> ACME Corp</div>
        <div className="flex items-center gap-2 text-xl font-bold font-sans"><Disc className="w-6 h-6" /> Vortex</div>
        <div className="flex items-center gap-2 text-xl font-bold font-serif"><Terminal className="w-6 h-6" /> Terminal.io</div>
        <div className="flex items-center gap-2 text-xl font-bold"><CheckCircle className="w-6 h-6" /> TaskMaster</div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-white/10 bg-black py-20 px-6">
    <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center ring-1 ring-primary/50">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-wide text-white">Seamless AI</span>
        </div>
        <p className="text-neutral-500 text-sm max-w-xs leading-relaxed">
          Empowering developers with local-first AI tools. Built for speed, privacy, and the future of coding.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-white">Product</h4>
        <ul className="space-y-2 text-sm text-neutral-500">
          <li><Link href="#" className="hover:text-primary transition-colors">Features</Link></li>
          <li><Link href="#" className="hover:text-primary transition-colors">Integrations</Link></li>
          <li><Link href="#" className="hover:text-primary transition-colors">Pricing</Link></li>
          <li><Link href="#" className="hover:text-primary transition-colors">Changelog</Link></li>
        </ul>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-white">Company</h4>
        <ul className="space-y-2 text-sm text-neutral-500">
          <li><Link href="#" className="hover:text-primary transition-colors">About</Link></li>
          <li><Link href="#" className="hover:text-primary transition-colors">Blog</Link></li>
          <li><Link href="#" className="hover:text-primary transition-colors">Careers</Link></li>
          <li><Link href="#" className="hover:text-primary transition-colors">Contact</Link></li>
        </ul>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
      <p>© 2026 Seamless AI. All rights reserved.</p>
      <div className="flex gap-6">
        <Link href="#" className="hover:text-neutral-400">Privacy Policy</Link>
        <Link href="#" className="hover:text-neutral-400">Terms of Service</Link>
      </div>
    </div>
  </footer>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/20 scroll-smooth">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />

        <section id="features" className="relative border-t border-white/5 bg-neutral-950/30">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950/50 to-black pointer-events-none" />
          <FeaturesSection />
        </section>

        <section id="roadmap" className="relative border-t border-white/5">
          <RoadmapSection />
        </section>

        <section id="pricing" className="relative border-t border-white/5">
          <PricingSection6 />
        </section>
      </main>
      <Footer />
    </div>
  );
}
