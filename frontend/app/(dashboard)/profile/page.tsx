"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, X, Shield, CheckCircle, ChevronDown, ChevronUp, Puzzle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  const [activeMethod, setActiveMethod] = useState<"cookie" | null>(null);
  const [credForm, setCredForm] = useState<{
    platform: string;
    username: string;
    session_cookie: string;
  }>({
    platform: "linkedin",
    username: "",
    session_cookie: "",
  });
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState("");
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

  const handleAddCredential = async (method: "cookie") => {
    setCredError("");
    if (!credForm.username) {
      setCredError("Email is required");
      return;
    }
    if (method === "cookie" && !credForm.session_cookie) {
      setCredError("Session cookie is required");
      return;
    }
    setCredSaving(true);
    try {
      const payload = {
        platform: credForm.platform,
        username: credForm.username,
        session_cookie: credForm.session_cookie,
      };
      await api.post("/credentials/", payload);
      const res = await api.get("/credentials/");
      setCredentials(res.data || []);
      setCredForm({ platform: "linkedin", username: "", session_cookie: "" });
      setActiveMethod(null);
    } catch (e: any) {
      setCredError(e.response?.data?.detail || "Failed to save credentials");
    } finally {
      setCredSaving(false);
    }
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

  const isLinked = (platform: string) => credentials.some((c) => c.platform === platform);

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
  const getLinked = (platform: string) => credentials.find((c) => c.platform === platform);

  const platformLabel = (p: string) => (p === "linkedin" ? "LinkedIn" : "Naukri");
  const platformColor = (p: string) => (p === "linkedin" ? "bg-blue-600" : "bg-yellow-500");
  const platformInitial = (p: string) => (p === "linkedin" ? "in" : "N");

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Profile</h1>

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>
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
                className="flex w-full rounded-md border border-gray-300 bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-500/10 text-primary-500 rounded-full text-sm">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {skills.length === 0 && <p className="text-sm text-muted-foreground/70">No skills added yet</p>}
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
                <div key={r.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN")}</p>
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
            <Zap className="w-5 h-5 text-primary-500" />
            Apply Mode
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
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
                    ? "border-primary-500 bg-primary-500/10 text-foreground"
                    : "border-border hover:border-muted-foreground text-foreground"
                }`}
              >
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Linked Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            Linked Accounts
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your LinkedIn and Naukri accounts to enable automatic job applications.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Connected accounts */}
          {credentials.length > 0 && (
            <div className="space-y-3">
              {credentials.map((cred: any) => (
                <div key={cred.id} className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${platformColor(cred.platform)}`}>
                      {platformInitial(cred.platform)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground capitalize">{platformLabel(cred.platform)}</p>
                      <p className="text-sm text-muted-foreground">{cred.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cred.is_active}
                        onCheckedChange={() => handleToggleCredential(cred)}
                      />
                      <span className={`text-xs font-medium ${cred.is_active ? "text-green-600" : "text-muted-foreground/70"}`}>
                        {cred.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCredential(cred.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLinked("linkedin") && isLinked("naukri") && (
            <div className="p-4 bg-green-500/10 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium">All accounts connected</p>
                <p className="text-green-600/80">Auto-apply is fully enabled on both platforms.</p>
              </div>
            </div>
          )}

          {/* Method 1: Browser Extension */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="p-4 flex items-center justify-between bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Browser Extension</p>
                  <p className="text-xs text-muted-foreground">Secure, reliable, and recommended</p>
                </div>
              </div>
              <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/15">Recommended</Badge>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Install the JobBlitz Chrome extension to connect your accounts securely. Your credentials never leave your browser.
              </p>
              <Button variant="outline" size="sm" disabled>
                <Puzzle className="w-4 h-4 mr-2" />
                Install Chrome Extension — Coming Soon
              </Button>
            </div>
          </div>

          {/* Method 2: Session Cookie */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveMethod(activeMethod === "cookie" ? null : "cookie")}
              className="w-full p-4 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Session Cookie</p>
                  <p className="text-xs text-muted-foreground">Fast, no password needed</p>
                </div>
              </div>
              {activeMethod === "cookie" ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground/70" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground/70" />
              )}
            </button>
            {activeMethod === "cookie" && (
              <div className="p-4 space-y-4">
                {credError && (
                  <div className="p-3 bg-red-500/10 border border-red-200 rounded-lg text-sm text-red-600">{credError}</div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Platform</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={credForm.platform}
                      onChange={(e) => setCredForm({ ...credForm, platform: e.target.value })}
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="naukri">Naukri</option>
                    </select>
                  </div>
                  <div>
                    <Label>Account Email</Label>
                    <Input
                      type="email"
                      placeholder="you@email.com"
                      value={credForm.username}
                      onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Session Cookie</Label>
                  <textarea
                    rows={3}
                    placeholder={`Paste your ${platformLabel(credForm.platform)} session cookie here...`}
                    value={credForm.session_cookie}
                    onChange={(e) => setCredForm({ ...credForm, session_cookie: e.target.value })}
                    className="mt-1 flex w-full rounded-md border border-gray-300 bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-1">
                  <p className="font-medium">How to get your session cookie:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Open {platformLabel(credForm.platform)} in your browser and log in.</li>
                    <li>Open DevTools (F12) → Application → Cookies.</li>
                    <li>
                      Copy the value of{" "}
                      <code className="bg-blue-500/15 px-1 rounded">{credForm.platform === "linkedin" ? "li_at" : "JSESSIONID"}</code>{" "}
                      and paste it above.
                    </li>
                  </ol>
                </div>
                <Button
                  type="button"
                  onClick={() => handleAddCredential("cookie")}
                  disabled={credSaving}
                >
                  {credSaving ? "Connecting..." : "Connect with Cookie"}
                </Button>
              </div>
            )}
          </div>

          {/* Security note */}
          <div className="p-3 bg-background border border-border rounded-lg text-xs text-muted-foreground flex gap-2">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground/70" />
            <span>
              JobBlitz never stores your password. We use secure cloud browser sessions to connect your accounts,
              and only session cookies are saved (encrypted with AES-256). LinkedIn and Naukri do not offer third-party OAuth for job applications.
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
