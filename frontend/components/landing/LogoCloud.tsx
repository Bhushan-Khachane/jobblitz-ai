"use client";

import { motion } from "framer-motion";

const logos = ["TCS", "Infosys", "Wipro", "HCL", "Tech Mahindra"];

export default function LogoCloud() {
  return (
    <section className="py-16 bg-white border-y border-gray-100">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-8"
        >
          Trusted by job seekers heading to
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {logos.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-2xl font-bold text-gray-300 hover:text-gray-500 transition-colors select-none"
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
