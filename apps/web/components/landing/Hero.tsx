"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const orbs = [
  { size: 600, x: "20%", y: "10%", color: "rgba(99,102,241,0.12)", blur: 120 },
  { size: 400, x: "70%", y: "50%", color: "rgba(139,92,246,0.10)", blur: 100 },
  { size: 300, x: "40%", y: "70%", color: "rgba(6,182,212,0.08)", blur: 90 },
];

const stats = [
  { value: "2,400+", label: "Jobs Applied Daily" },
  { value: "94%", label: "ATS Pass Rate" },
  { value: "3.2x", label: "More Interviews" },
  { value: "10 hrs", label: "Saved Per Week" },
];

const floatingCards = [
  { title: "Senior Backend Engineer", company: "Razorpay", badge: "Applied", color: "border-indigo-500/30 bg-indigo-500/5", x: "5%", y: "22%" },
  { title: "Data Scientist", company: "Flipkart", badge: "Matched", color: "border-violet-500/30 bg-violet-500/5", x: "72%", y: "15%" },
  { title: "Product Manager", company: "Zepto", badge: "Applied", color: "border-cyan-500/30 bg-cyan-500/5", x: "78%", y: "58%" },
  { title: "Frontend Engineer", company: "Cred", badge: "Interview", color: "border-green-500/30 bg-green-500/5", x: "2%", y: "62%" },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050508] pt-20">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: orb.size, height: orb.size,
            left: orb.x, top: orb.y,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: `blur(${orb.blur}px)`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)", backgroundSize: "60px 60px" }}
      />

      {floatingCards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 + i * 0.2, duration: 0.8 }}
          className="absolute hidden xl:block"
          style={{ left: card.x, top: card.y }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
            className={`border ${card.color} backdrop-blur-xl rounded-2xl px-5 py-3.5 w-56 glow-indigo`}
          >
            <p className="text-sm font-semibold text-white/90">{card.title}</p>
            <p className="text-xs text-white/40 mt-0.5">{card.company}</p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.badge === "Interview" ? "bg-green-400" : card.badge === "Applied" ? "bg-indigo-400" : "bg-violet-400"} animate-pulse-glow`} />
              <span className={`text-[10px] font-medium ${card.badge === "Interview" ? "text-green-400" : card.badge === "Applied" ? "text-indigo-400" : "text-violet-400"}`}>{card.badge}</span>
            </div>
          </motion.div>
        </motion.div>
      ))}

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
          <div className="inline-flex items-center gap-2 border border-indigo-500/30 bg-indigo-500/10 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-8 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered · Zero-Password · Fully Autonomous
          </div>

          <h1 className="text-5xl md:text-7xl xl:text-8xl font-black text-white leading-[0.95] tracking-tight mb-6">
            Land Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 text-glow">
              Dream Job
            </span>
            <br />While You Sleep
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            JobBlitz applies to hundreds of jobs on LinkedIn, Naukri, and more — with AI-tailored resumes,
            human-like automation, and real-time tracking.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-base font-semibold rounded-xl glow-indigo transition-all hover:scale-[1.02]">
                Start Free — No Credit Card <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="ghost" className="text-white/60 hover:text-white border border-white/10 px-8 py-6 text-base rounded-xl hover:bg-white/5">
                See How It Works
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
            {stats.map((s) => (
              <div key={s.label} className="bg-[#0a0a0f] px-6 py-5 text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}