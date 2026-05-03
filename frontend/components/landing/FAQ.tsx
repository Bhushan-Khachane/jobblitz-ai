"use client";

import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Is it safe to use automation on LinkedIn and Naukri?",
    a: "JobBlitz uses stealth browser technology with human-like delays and random viewports. We follow each platform's rate limits and simulate natural browsing behavior. However, we recommend using a secondary account if you're concerned.",
  },
  {
    q: "Will LinkedIn or Naukri ban my account?",
    a: "We've designed JobBlitz to stay well within normal usage patterns. The bot applies to a reasonable number of jobs per day and includes random delays between actions. We also provide configurable limits so you stay in control.",
  },
  {
    q: "How does JobBlitz handle my login credentials?",
    a: "Your credentials are encrypted with AES-256 (Fernet) before being stored. We never log or display raw passwords. All browser sessions run in isolated contexts. You can delete your credentials at any time.",
  },
  {
    q: "What is the refund policy?",
    a: "We offer a 7-day money-back guarantee on Pro subscriptions. If JobBlitz doesn't work for you, contact support within 7 days of purchase for a full refund. No questions asked.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes. You can cancel from your dashboard's Billing page at any time. Your access continues until the end of the current billing period. No cancellation fees.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Frequently asked questions</h2>
          <p className="mt-4 text-lg text-gray-500">Everything you need to know about JobBlitz.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-medium text-gray-900">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
