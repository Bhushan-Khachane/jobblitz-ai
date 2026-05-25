"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { usersAPI } from "@/lib/api";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    usersAPI
      .me()
      .then(({ profile }) => {
        if (!profile) return;
        setForm({
          keywords: (profile.preferredJobTitles || []).join(", "),
          locations: (profile.preferredLocations || []).join(", "),
          salaryMin: profile.salaryMinLpa?.toString() || "",
          salaryMax: profile.salaryMaxLpa?.toString() || "",
          experienceLevel: String(profile.experienceYears || ""),
          remoteOnly: false,
          portals: [],
        });
      })
      .catch(() => {
        // leave defaults if no profile exists yet
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: unknown) => {
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
    setMessage("");
    setError("");
    try {
      const payload = {
        preferredJobTitles: form.keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        preferredLocations: form.locations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        salaryMinLpa: form.salaryMin ? parseFloat(form.salaryMin) : null,
        salaryMaxLpa: form.salaryMax ? parseFloat(form.salaryMax) : null,
        experienceYears: form.experienceLevel ? parseInt(form.experienceLevel, 10) : null,
      };
      await usersAPI.updateMe(payload);
      setMessage("Job preferences saved successfully.");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Job Profile</h1>
        <p className="text-muted-foreground mt-1">
          Configure your target jobs for discovery and scoring.
        </p>
      </div>

      {message && (
        <div className="bg-green-500/10 text-green-400 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Keywords
          </label>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => handleChange("keywords", e.target.value)}
            placeholder="e.g. software engineer, backend developer"
            className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Locations
          </label>
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
            <label className="block text-sm font-medium text-foreground mb-1">
              Min Salary (LPA)
            </label>
            <input
              type="number"
              value={form.salaryMin}
              onChange={(e) => handleChange("salaryMin", e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Max Salary (LPA)
            </label>
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
          <label className="block text-sm font-medium text-foreground mb-1">
            Experience Level
          </label>
          <select
            value={form.experienceLevel}
            onChange={(e) => handleChange("experienceLevel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-white/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Any</option>
            <option value="0">Entry Level (0-2 years)</option>
            <option value="3">Mid Level (2-5 years)</option>
            <option value="5">Senior (5+ years)</option>
            <option value="10">Lead / Manager</option>
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
          <label htmlFor="remoteOnly" className="text-sm text-foreground">
            Remote only
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Target Portals
          </label>
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
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Profile
        </button>
      </div>
    </div>
  );
}
