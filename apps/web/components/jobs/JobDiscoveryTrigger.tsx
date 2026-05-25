"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jobsAPI } from "@/lib/api";

interface Props {
  onDiscover: () => void;
}

export default function JobDiscoveryTrigger({ onDiscover }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleDiscover = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await jobsAPI.discover();
      setMessage(`Discovery started! Task: ${res.taskId}. Estimated: ${res.estimatedSeconds}s`);
      setTimeout(() => {
        onDiscover();
      }, 3000);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "Discovery failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleDiscover}
        disabled={loading}
        className="w-full sm:w-auto gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {loading ? "Scanning portals..." : "Find Best Jobs"}
      </Button>
      {message && (
        <p className={`text-sm ${message.includes("failed") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
