"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-[#050508]/90 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center glow-indigo">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">JobBlitz</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {["Features", "How It Works", "Pricing", "FAQ"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm text-white/50 hover:text-white transition-colors">
              {item}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4">
              Get Started Free
            </Button>
          </Link>
        </div>

        <button className="md:hidden text-white/60 hover:text-white" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#050508]/95 backdrop-blur-xl border-b border-white/5 px-6 pb-6 space-y-4">
          {["Features", "How It Works", "Pricing"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              className="block text-white/60 hover:text-white text-sm py-1" onClick={() => setOpen(false)}>
              {item}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="flex-1"><Button variant="ghost" size="sm" className="w-full text-white/60 hover:text-white">Sign In</Button></Link>
            <Link href="/register" className="flex-1"><Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">Get Started</Button></Link>
          </div>
        </div>
      )}
    </nav>
  );
}