"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, X, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import ResumeUploader from "@/components/dashboard/ResumeUploader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import api from "@/lib/api";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional(),
  location: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  expected_salary_lpa: z.string().optional(),
  notice_period_days: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [resumes, setResumes] = useState<any[]>([]);
  const [success, setSuccess] = useState("");
  const [credentials, setCredentials] = useState<any[]>([]);
  const [applyMode, setApplyMode] = useState<string>("manual");
  const [modeSaving, setModeSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, profileRes, resumeRes, credRes] = await Promise.all([
          api.get("/users/me"),
          api.get("/users/me/profile").catch(() => ({ data: null })),
          api.get("/resumes/"),
          api.get("/credentials/").catch(() => ({ data: [] })),
        ]);
        const user = userRes.data;
        const profile = profileRes.data;
        reset({
          full_name: user.full_name || "",
          phone: user.phone || "",
          location: user.location || "",
          headline: profile?.headline || "",
          summary: profile?.summary || "",
          expected_salary_lpa: profile?.expected_salary_lpa?.toString() || "",
          notice_period_days: profile?.notice_period_days?.toString() || "",
        });
        if (profile?.skills) {
          setSkills(Array.isArray(profile.skills) ? profile.skills : Object.keys(profile.skills));
        }
        setResumes(resumeRes.data || []);
        setCredentials(credRes.data || []);
        setApplyMode(user.application_mode || "manual");
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reset]);

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    setSuccess("");
    try {
      await api.put("/users/me", {
        full_name: data.full_name,
        phone: data.phone || null,
        location: data.location || null,
      });
      await api.put("/users/me/profile", {
        headline: data.headline || null,
        summary: data.summary || null,
        skills: skills,
        expected_salary_lpa: data.expected_salary_lpa ? parseFloat(data.expected_salary_lpa) : null,
        notice_period_days: data.notice_period_days ? parseInt(data.notice_period_days) : null,
      });
      setSuccess("Profile updated successfully!");
    } catch {
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (s: string) => setSkills(skills.filter((sk) => sk !== s));

  const handleResumeUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    await api.post("/resumes/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
    const res = await api.get("/resumes/");
    setResumes(res.data || []);
  };

  const toggleDefault = async (id: string) => {
    await api.put(`/resumes/${id}`, { is_default: true }).catch(() => {});
    const res = await api.get("/resumes/");
    setResumes(res.data || []);
  };

  const handleDeleteCredential = async (id: string) => {
    if (!confirm("Remove this account?")) return;
    try {
      await api.delete(`/credentials/${id}`);
      setCredentials(credentials.filter((c) => c.id !== id));
    } catch {
      alert("Failed to remove credential");
    }
  };

  const handleToggleCredential = async (cred: any) => {
    try {
      await api.put(`/credentials/${cred.id}`, { is_active: !cred.is_active });
      const res = await api.get("/credentials/");
      setCredentials(res.data || []);
    } catch {}
  };

  const handleModeChange = async (mode: string) => {
    setModeSaving(true);
    try {
      await api.patch("/users/me/application-mode", { mode });
      setApplyMode(mode);
    } catch {
      alert("Failed to update apply mode");
    } finally {
      setModeSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Profile</h1>

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">{success}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" {...register("full_name")} />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="Bangalore, India" {...register("location")} />
              </div>
              <div>
                <Label htmlFor="headline">Professional Headline</Label>
                <Input id="headline" placeholder="Senior Frontend Developer" {...register("headline")} />
              </div>
            </div>
            <div>
              <Label htmlFor="summary">Professional Summary</Label>
              <textarea
                id="summary"
                rows={4}
                className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Brief overview of your experience and goals..."
                {...register("summary")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add a skill..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-sm">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {skills.length === 0 && <p className="text-sm text-white/30">No skills added yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salary">Expected Salary (LPA)</Label>
                <Input id="salary" type="number" {...register("expected_salary_lpa")} />
              </div>
              <div>
                <Label htmlFor="notice">Notice Period (days)</Label>
                <Input id="notice" type="number" {...register("notice_period_days")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </form>

      <Separator className="my-8" />

      {/* Resumes */}
      <Card>
        <CardHeader>
          <CardTitle>Resumes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resumes.length > 0 && (
            <div className="space-y-2">
              {resumes.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-white/90">{r.title}</p>
                    <p className="text-xs text-white/40">{new Date(r.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_default && (
                      <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">Default</span>
                    )}
                    {!r.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => toggleDefault(r.id)}>
                        Set as default
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <ResumeUploader onUpload={handleResumeUpload} />
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Apply Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            Apply Mode
          </CardTitle>
          <p className="text-sm text-white/40 mt-1">
            Control how JobBlitz submits applications on your behalf.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: "manual", label: "Manual", desc: "You review and submit each application yourself" },
              { value: "assisted", label: "Assisted", desc: "AI fills forms, you approve before submitting" },
              { value: "auto", label: "Auto", desc: "Fully automatic — AI finds and applies for you" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={modeSaving}
                onClick={() => handleModeChange(opt.value)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  applyMode === opt.value
                    ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                    : "border-white/5 hover:border-white/20 text-white/60"
                }`}
              >
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-white/40 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Linked Accounts — Neko redirect only */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Connected Accounts
          </CardTitle>
          <p className="text-sm text-white/40 mt-1">
            Connect your job portal accounts via our secure cloud browser.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Show existing credentials */}
          {credentials.length > 0 && (
            <div className="space-y-3">
              {credentials.map((cred: any) => (
                <div key={cred.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      cred.platform === "linkedin" ? "bg-blue-600" : cred.platform === "naukri" ? "bg-amber-500" : "bg-indigo-600"
                    }`}>
                      {cred.platform === "linkedin" ? "in" : cred.platform === "naukri" ? "N" : cred.platform[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white/90 capitalize">{cred.platform}</p>
                      <p className="text-sm text-white/40">{cred.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cred.is_active}
                        onCheckedChange={() => handleToggleCredential(cred)}
                      />
                      <span className={`text-xs font-medium ${cred.is_active ? "text-green-400" : "text-white/30"}`}>
                        {cred.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCredential(cred.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Neko redirect message */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <p className="font-semibold text-white/90">Connect accounts securely</p>
              <p className="text-sm text-white/40 mt-1">
                Use the{" "}
                <a href="/connect" className="text-indigo-400 underline hover:text-indigo-300">
                  Connect Accounts
                </a>{" "}
                page to link LinkedIn and Naukri via our secure cloud browser.
                Your password never reaches our servers.
              </p>
            </div>
          </div>

          {/* Security note */}
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg text-xs text-white/30 flex gap-2">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/20" />
            <span>
              JobBlitz never stores your password. We use secure cloud browser sessions to connect your accounts,
              and only session cookies are saved (encrypted with AES-256).
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}