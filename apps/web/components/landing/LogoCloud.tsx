"use client";

import { motion } from "framer-motion";

const platforms = [
  { name: "LinkedIn", color: "text-blue-400", emoji: "💼" },
  { name: "Naukri", color: "text-amber-400", emoji: "🔍" },
  { name: "Shine", color: "text-orange-400", emoji: "✨" },
  { name: "Unstop", color: "text-purple-400", emoji: "🚀" },
  { name: "Wellfound", color: "text-cyan-400", emoji: "🌐" },
  { name: "Internshala", color: "text-green-400", emoji: "🎓" },
];

export default function LogoCloud() {
  return (
    <section className="py-16 bg-[#050508] border-y border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-sm text-white/30 uppercase tracking-widest mb-10 font-medium">
          Automates applications across
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {platforms.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">{p.emoji}</span>
              <span className={`text-xs font-medium ${p.color}`}>{p.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}