"use client";

import { motion } from "framer-motion";
import { FileText, Bot, BarChart3, Shield, Zap, Brain } from "lucide-react";

const features = [
  { icon: Brain, title: "AI Job Matching", desc: "Scores every job against your resume using semantic AI. Only applies to jobs with >30% match — saving your quota for jobs worth applying to.", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
  { icon: Bot, title: "Multi-Platform Bot", desc: "Applies on LinkedIn Easy Apply, Naukri, Shine, Unstop, Wellfound, and Internshala — with human-like delays and random viewports to stay undetected.", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  { icon: FileText, title: "AI Resume Tailoring", desc: "Rewrites your resume bullet points for each job posting. Maximizes ATS keyword match before every application.", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  { icon: Shield, title: "Zero-Password Security", desc: "You log in through a cloud browser we stream to you. Your password never touches our servers — only session cookies are stored, encrypted at rest.", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { icon: BarChart3, title: "Real-Time Analytics", desc: "Live Kanban board, platform breakdown charts, match score distributions, and interview funnel — all updating via Supabase Realtime.", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { icon: Zap, title: "Approval Queue", desc: "In Assisted mode, review AI's shortlisted jobs before they're submitted. One click to approve or reject — you stay in control.", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
];

export default function Features() {
  return (
    <section id="features" className="py-28 bg-[#050508]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
            Not just automation.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Intelligence.</span>
          </h2>
          <p className="text-white/40 text-lg max-w-2xl mx-auto">
            Six systems working together to maximize your interview rate.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <div className={`h-full border ${f.bg} backdrop-blur-sm rounded-2xl p-6 hover:scale-[1.02] transition-transform`}>
                <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4 border ${f.bg}`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}