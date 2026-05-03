"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const floatingCards = [
  { title: "Frontend Engineer", company: "TCS", x: "10%", y: "20%", delay: 0 },
  { title: "Data Analyst", company: "Infosys", x: "70%", y: "15%", delay: 0.3 },
  { title: "Backend Developer", company: "Wipro", x: "80%", y: "60%", delay: 0.6 },
  { title: "Product Manager", company: "Flipkart", x: "5%", y: "65%", delay: 0.9 },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 pt-20">
      {/* Floating job cards */}
      {floatingCards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: card.delay + 0.5, duration: 0.8, ease: "easeOut" }}
          className="absolute hidden lg:block"
          style={{ left: card.x, top: card.y }}
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 px-5 py-3 w-52"
          >
            <p className="text-sm font-semibold text-gray-900">{card.title}</p>
            <p className="text-xs text-gray-500">{card.company}</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[10px] text-green-600 font-medium">Auto-applied</span>
            </div>
          </motion.div>
        </motion.div>
      ))}

      {/* Glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            AI-Powered Job Automation
          </span>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight">
            Apply to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">100+ Jobs</span>{" "}
            on Auto-Pilot
          </h1>

          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            JobBlitz AI automates LinkedIn &amp; Naukri applications with AI-tailored resumes. 
            Stop wasting hours on repetitive forms — let the bot do it while you prep for interviews.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-base px-8 py-6 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow">
                Start Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="text-base px-8 py-6">
              <Play className="mr-2 w-5 h-5" /> Watch Demo
            </Button>
          </div>

          <p className="mt-4 text-sm text-gray-400">No credit card required · 5 free applications/day</p>
        </motion.div>
      </div>
    </section>
  );
}
