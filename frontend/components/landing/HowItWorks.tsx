"use client";

import { motion } from "framer-motion";
import { Upload, Settings, Trophy } from "lucide-react";

const steps = [
  {
    icon: Upload,
    num: "01",
    title: "Upload Resume",
    desc: "Upload your PDF resume. Our AI parses it and extracts your skills, experience, and education automatically.",
  },
  {
    icon: Settings,
    num: "02",
    title: "Set Preferences",
    desc: "Choose job titles, locations, salary range, and platforms. Connect your LinkedIn and Naukri credentials securely.",
  },
  {
    icon: Trophy,
    num: "03",
    title: "Get Interviews",
    desc: "Sit back while JobBlitz applies to matching jobs 24/7. Track every application on your dashboard.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-[#050508]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white">How it works</h2>
          <p className="mt-4 text-lg text-white/50">Three simple steps to automate your job search.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-12">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="text-center"
            >
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <s.icon className="w-8 h-8 text-indigo-400" />
                </div>
                <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center border border-indigo-400/30">
                  {s.num}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{s.title}</h3>
              <p className="text-white/50 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
