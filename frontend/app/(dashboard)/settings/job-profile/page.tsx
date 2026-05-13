"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";

export default function JobProfilePage() {
  const [form, setForm] = useState({
    keywords: "",
    locations: "",
    salaryMin: "",
    salaryMax: "",
    experienceLevel: "",
    remoteOnly: false,
    portals: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePortal = (portal: string) => {
    setForm((prev) => ({
      ...prev,
      portals: prev.portals.includes(portal)
        ? prev.portals.filter((p) => p !== portal)
        : [...prev.portals, portal],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: save to /api/v1/users/me/profile or a dedicated endpoint
      await new Promise((r) => setTimeout(r, 500));
      alert("Saved (placeholder)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Job Profile</h1>
        <p className="text-muted-foreground mt-1">
          Configure your target jobs for discovery and scoring.
        </p>
      </div>

      <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Keywords</label>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => handleChange("keywords", e.target.value)}
            placeholder="e.g. software engineer, backend developer"
            className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Locations</label>
          <input
            type="text"
            value={form.locations}
            onChange={(e) => handleChange("locations", e.target.value)}
            placeholder="e.g. Bangalore, Remote"
            className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Min Salary (LPA)</label>
            <input
              type="number"
              value={form.salaryMin}
              onChange={(e) => handleChange("salaryMin", e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Max Salary (LPA)</label>
            <input
              type="number"
              value={form.salaryMax}
              onChange={(e) => handleChange("salaryMax", e.target.value)}
              placeholder="50"
              className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Experience Level</label>
          <select
            value={form.experienceLevel}
            onChange={(e) => handleChange("experienceLevel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Any</option>
            <option value="entry">Entry Level (0-2 years)</option>
            <option value="mid">Mid Level (2-5 years)</option>
            <option value="senior">Senior (5+ years)</option>
            <option value="lead">Lead / Manager</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="remoteOnly"
            type="checkbox"
            checked={form.remoteOnly}
            onChange={(e) => handleChange("remoteOnly", e.target.checked)}
            className="w-4 h-4 rounded border-white/10 bg-background text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="remoteOnly" className="text-sm text-foreground">Remote only</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Target Portals</label>
          <div className="flex flex-wrap gap-2">
            {["naukri", "linkedin", "indeed"].map((portal) => (
              <button
                key={portal}
                type="button"
                onClick={() => togglePortal(portal)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.portals.includes(portal)
                    ? "bg-primary-500/20 text-primary-400 border-primary-500/30"
                    : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                }`}
              >
                {portal.charAt(0).toUpperCase() + portal.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile
        </button>
      </div>
    </div>
  );
}
