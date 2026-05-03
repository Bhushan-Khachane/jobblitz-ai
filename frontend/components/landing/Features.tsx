"use client";

import { motion } from "framer-motion";
import { FileText, Bot, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: FileText,
    title: "AI Resume Tailoring",
    desc: "Our AI rewrites your resume for each job posting, maximizing ATS match scores and getting you past automated filters.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Bot,
    title: "Multi-Platform Bot",
    desc: "Automatically fills applications on LinkedIn and Naukri. Handles forms, uploads resumes, and answers screening questions.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: BarChart3,
    title: "Smart Tracker",
    desc: "Real-time dashboard shows every application's status. Kanban board, analytics, and success rate tracking in one place.",
    color: "bg-green-50 text-green-600",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Everything you need to land your next job</h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            Three powerful tools working together to automate your entire job search workflow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow border-0 shadow-md">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{f.desc}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
