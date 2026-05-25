"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Briefcase,
  Shield,
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  User,
  Target,
  Settings,
  Sparkles,
  Linkedin,
  Globe,
  Clock,
  MapPin,
  Wallet,
  Home,
  Loader2,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import api, { type Profile } from "@/lib/api";

const TOTAL_STEPS = 5;

const stepsMeta = [
  { id: 1, title: "Upload Resume", icon: User },
  { id: 2, title: "Target Roles", icon: Target },
  { id: 3, title: "Connect Portals", icon: Shield },
  { id: 4, title: "Preferences", icon: Settings },
  { id: 5, title: "Discovery", icon: Sparkles },
];

/* ─── Step 2 Schema ─── */
const targetRolesSchema = z.object({
  preferredJobTitles: z.string().min(1, "Enter at least one job title"),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead"]),
  preferredLocations: z.string().optional(),
  salaryMinLpa: z.coerce.number().min(0).max(200).optional(),
  salaryMaxLpa: z.coerce.number().min(0).max(200).optional(),
  noticePeriodDays: z.coerce.number().min(0).max(365).optional(),
  remoteOnly: z.boolean().default(false),
  jobType: z.enum(["full-time", "contract", "internship", "part-time", "freelance"]).default("full-time"),
  workMode: z.enum(["remote", "hybrid", "onsite"]).default("hybrid"),
});

type TargetRolesValues = z.infer<typeof targetRolesSchema>;

/* ─── Step 4 Schema ─── */
const preferencesSchema = z.object({
  applicationMode: z.enum(["manual", "assisted", "auto"]).default("assisted"),
  dailyApplyLimit: z.coerce.number().min(1).max(50).default(10),
  preferredStartHour: z.coerce.number().min(0).max(23).default(9),
  preferredEndHour: z.coerce.number().min(0).max(23).default(18),
});

type PreferencesValues = z.infer<typeof preferencesSchema>;

export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  /* Step 1 */
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parsedProfile, setParsedProfile] = useState<Record<string, unknown> | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [editHeadline, setEditHeadline] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editSkills, setEditSkills] = useState("");

  /* Step 3 */
  const [portalSessions, setPortalSessions] = useState<Record<string, { status: string; verified: boolean }>>({});
  const [connectingPortal, setConnectingPortal] = useState<string | null>(null);

  /* Step 5 */
  const [discovering, setDiscovering] = useState(false);
  const [discoveryDone, setDiscoveryDone] = useState(false);
  const [discoveryTaskId, setDiscoveryTaskId] = useState<string | null>(null);

  /* ─── Load profile on mount ─── */
  useEffect(() => {
    api
      .get("/users/me/profile")
      .then((res) => {
        const p = res.data as Profile;
        setProfile(p);
        if (p.onboardingStep && p.onboardingStep >= 1 && p.onboardingStep <= TOTAL_STEPS) {
          setStep(p.onboardingStep);
        }
        if (p.parsedProfile) {
          setParsedProfile(p.parsedProfile as Record<string, unknown>);
        }
        if (p.headline) setEditHeadline(p.headline);
        if (p.summary) setEditSummary(p.summary);
        if (p.skills) setEditSkills(p.skills.join(", "));
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  /* ─── Load portal sessions ─── */
  const fetchPortalSessions = useCallback(async () => {
    try {
      const res = await api.get("/portal-sessions/");
      const sessions = (res.data as { sessions: Array<{ portal: string; status: string; verified: boolean }> }).sessions || [];
      const map: Record<string, { status: string; verified: boolean }> = {};
      for (const s of sessions) {
        map[s.portal] = { status: s.status, verified: s.verified };
      }
      setPortalSessions(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (step === 3) fetchPortalSessions();
  }, [step, fetchPortalSessions]);

  /* ─── Step 1: Resume Upload ─── */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") setResumeFile(f);
  }, []);

  const handleResumeUpload = useCallback(async () => {
    if (!resumeFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      formData.append("title", resumeFile.name);
      formData.append("is_default", "true");
      await api.post("/resumes/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Fetch updated profile with extracted data
      setExtracting(true);
      const res = await api.get("/users/me/profile");
      const p = res.data as Profile;
      setProfile(p);
      if (p.parsedProfile) setParsedProfile(p.parsedProfile as Record<string, unknown>);
      if (p.headline) setEditHeadline(p.headline);
      if (p.summary) setEditSummary(p.summary);
      if (p.skills) setEditSkills(p.skills.join(", "));
    } catch (e: any) {
      alert(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  }, [resumeFile]);

  const saveStep1 = async () => {
    try {
      await api.put("/users/me/profile", {
        headline: editHeadline || null,
        summary: editSummary || null,
        skills: editSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        onboarding_step: 2,
      });
      setStep(2);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save profile");
    }
  };

  /* ─── Step 2: Target Roles Form ─── */
  const targetForm = useForm<TargetRolesValues>({
    resolver: zodResolver(targetRolesSchema),
    defaultValues: {
      preferredJobTitles: profile?.preferredJobTitles?.join(", ") || "",
      experienceLevel: (profile?.experienceLevel as "entry" | "mid" | "senior" | "lead") || "mid",
      preferredLocations: profile?.preferredLocations?.join(", ") || "",
      salaryMinLpa: profile?.salaryMinLpa ?? undefined,
      salaryMaxLpa: profile?.salaryMaxLpa ?? undefined,
      noticePeriodDays: profile?.noticePeriodDays ?? 30,
      remoteOnly: profile?.remoteOnly ?? false,
      jobType: (profile?.jobType as "full-time" | "contract" | "internship" | "part-time" | "freelance") || "full-time",
      workMode: (profile?.workMode as "remote" | "hybrid" | "onsite") || "hybrid",
    },
  });

  // Sync form defaults when profile loads
  useEffect(() => {
    if (profile) {
      targetForm.reset({
        preferredJobTitles: profile.preferredJobTitles?.join(", ") || "",
        experienceLevel: (profile.experienceLevel as "entry" | "mid" | "senior" | "lead") || "mid",
        preferredLocations: profile.preferredLocations?.join(", ") || "",
        salaryMinLpa: profile.salaryMinLpa ?? undefined,
        salaryMaxLpa: profile.salaryMaxLpa ?? undefined,
        noticePeriodDays: profile.noticePeriodDays ?? 30,
        remoteOnly: profile.remoteOnly ?? false,
        jobType: (profile.jobType as "full-time" | "contract" | "internship" | "part-time" | "freelance") || "full-time",
        workMode: (profile.workMode as "remote" | "hybrid" | "onsite") || "hybrid",
      });
    }
  }, [profile, targetForm]);

  const handleTargetSubmit = async (data: TargetRolesValues) => {
    try {
      await api.put("/users/me/profile", {
        preferred_job_titles: data.preferredJobTitles.split(",").map((s) => s.trim()).filter(Boolean),
        experience_level: data.experienceLevel,
        preferred_locations: data.preferredLocations?.split(",").map((s) => s.trim()).filter(Boolean) || [],
        salary_min_lpa: data.salaryMinLpa ?? null,
        salary_max_lpa: data.salaryMaxLpa ?? null,
        notice_period_days: data.noticePeriodDays ?? null,
        remote_only: data.remoteOnly,
        job_type: data.jobType,
        work_mode: data.workMode,
        onboarding_step: 3,
      });
      setStep(3);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save preferences");
    }
  };

  /* ─── Step 3: Connect Portals ─── */
  const handleConnect = async (portal: string) => {
    setConnectingPortal(portal);
    try {
      const res = await api.post("/portal-sessions/", { portal });
      const data = res.data as { session_id: string };
      window.location.href = `/portals/connect/${portal}?session_id=${data.session_id}`;
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to start browser session");
    } finally {
      setConnectingPortal(null);
    }
  };

  const saveStep3 = async () => {
    try {
      await api.put("/users/me/profile", { onboarding_step: 4 });
      setStep(4);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save");
    }
  };

  /* ─── Step 4: Application Preferences ─── */
  const prefForm = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      applicationMode: "assisted",
      dailyApplyLimit: 10,
      preferredStartHour: 9,
      preferredEndHour: 18,
    },
  });

  const handlePrefSubmit = async (data: PreferencesValues) => {
    try {
      await api.patch("/users/me", {
        application_mode: data.applicationMode,
        daily_apply_limit: data.dailyApplyLimit,
      });
      await api.put("/users/me/profile", {
        onboarding_step: 5,
      });
      setStep(5);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save preferences");
    }
  };

  /* ─── Step 5: Run Discovery ─── */
  const startDiscovery = async () => {
    setDiscovering(true);
    try {
      const titles = profile?.preferredJobTitles?.join(", ") || targetForm.getValues("preferredJobTitles");
      const locs = profile?.preferredLocations?.join(", ") || targetForm.getValues("preferredLocations");
      const res = await api.post("/api/discovery/run", {
        keywords: titles,
        location: locs,
        portal: "both",
        yearsExperience: profile?.experienceYears ?? 2,
        jobAgeDays: 7,
      });
      const data = res.data as { taskId: string };
      setDiscoveryTaskId(data.taskId);
      // Simulate progress for UX; in real app you'd poll the task status
      setTimeout(() => {
        setDiscovering(false);
        setDiscoveryDone(true);
        fireConfetti();
      }, 4000);
    } catch {
      setDiscovering(false);
      alert("Discovery failed to start. You can run it later from the dashboard.");
    }
  };

  const finishOnboarding = async () => {
    try {
      await api.put("/users/me/profile", { onboarding_step: 5 });
    } catch {}
    router.push("/dashboard");
  };

  const fireConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 } };
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">JobBlitz</span>
      </div>

      {/* Stepper */}
      <div className="max-w-3xl mx-auto w-full px-6 mt-4 mb-8">
        <div className="flex items-center justify-between">
          {stepsMeta.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step > s.id
                      ? "bg-primary text-primary-foreground"
                      : step === s.id
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.id ? <Check className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className="text-xs font-medium text-muted-foreground mt-2 hidden sm:block">{s.title}</span>
              </div>
              {i < stepsMeta.length - 1 && (
                <div className={`w-12 md:w-24 h-0.5 mx-2 mt-[-20px] ${step > s.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pb-12">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {/* ── Step 1 ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-1">Upload your resume</h2>
                      <p className="text-sm text-muted-foreground">We&apos;ll parse it to auto-fill your profile and tailor it for each job.</p>
                    </div>

                    {/* Upload zone */}
                    {!parsedProfile && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                          dragging ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">Drag & drop your PDF resume here</p>
                        <label className="inline-block cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) setResumeFile(f); }}
                          />
                          <span className="text-sm font-medium text-primary hover:underline">or browse files</span>
                        </label>
                      </div>
                    )}

                    {resumeFile && !parsedProfile && (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Upload className="w-5 h-5 text-primary" />
                        <span className="text-sm text-foreground flex-1 truncate">{resumeFile.name}</span>
                        <Badge variant="secondary">{(resumeFile.size / 1024).toFixed(0)} KB</Badge>
                      </div>
                    )}

                    {resumeFile && !parsedProfile && (
                      <div className="flex justify-end">
                        <Button onClick={handleResumeUpload} disabled={uploading || extracting}>
                          {uploading ? "Uploading..." : extracting ? "Extracting..." : "Upload & Parse"}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    )}

                    {/* Extracted data editor */}
                    {(parsedProfile || profile?.headline) && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          AI extracted the following from your resume
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="headline">Headline</Label>
                            <Input
                              id="headline"
                              value={editHeadline}
                              onChange={(e) => setEditHeadline(e.target.value)}
                              placeholder="e.g. Senior React Developer"
                            />
                          </div>

                          <div>
                            <Label htmlFor="summary">Professional Summary</Label>
                            <textarea
                              id="summary"
                              rows={4}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={editSummary}
                              onChange={(e) => setEditSummary(e.target.value)}
                              placeholder="Brief summary of your career..."
                            />
                          </div>

                          <div>
                            <Label htmlFor="skills">Skills (comma separated)</Label>
                            <Input
                              id="skills"
                              value={editSkills}
                              onChange={(e) => setEditSkills(e.target.value)}
                              placeholder="React, TypeScript, Node.js..."
                            />
                          </div>

                          {parsedProfile && (
                            <div className="grid grid-cols-2 gap-3">
                              {parsedProfile.experience_years !== undefined && (
                                <div className="p-2 bg-muted rounded text-sm">
                                  <span className="text-muted-foreground">Experience:</span>{" "}
                                  {String(parsedProfile.experience_years)} years
                                </div>
                              )}
                              {parsedProfile.current_ctc_lpa !== undefined && (
                                <div className="p-2 bg-muted rounded text-sm">
                                  <span className="text-muted-foreground">Current CTC:</span>{" "}
                                  {String(parsedProfile.current_ctc_lpa)} LPA
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between pt-2">
                          <Button variant="ghost" onClick={() => setStep(2)}>
                            Skip <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                          <Button onClick={saveStep1}>
                            Save & Continue <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-1">Target roles</h2>
                      <p className="text-sm text-muted-foreground">Tell us what you&apos;re looking for so we can find the best matches.</p>
                    </div>

                    <form onSubmit={targetForm.handleSubmit(handleTargetSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="titles">
                          <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                          Job titles
                        </Label>
                        <Input
                          id="titles"
                          placeholder="React Developer, Frontend Engineer, UI Engineer"
                          {...targetForm.register("preferredJobTitles")}
                        />
                        {targetForm.formState.errors.preferredJobTitles && (
                          <p className="text-xs text-destructive mt-1">{targetForm.formState.errors.preferredJobTitles.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple titles with commas</p>
                      </div>

                      <div>
                        <Label htmlFor="expLevel">Experience Level</Label>
                        <select
                          id="expLevel"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          {...targetForm.register("experienceLevel")}
                        >
                          <option value="entry">Entry-level (0-2 years)</option>
                          <option value="mid">Mid-level (2-5 years)</option>
                          <option value="senior">Senior (5-10 years)</option>
                          <option value="lead">Lead / Staff (10+ years)</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="locations">
                          <MapPin className="w-3.5 h-3.5 inline mr-1" />
                          Preferred locations
                        </Label>
                        <Input
                          id="locations"
                          placeholder="Bangalore, Hyderabad, Remote"
                          {...targetForm.register("preferredLocations")}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple locations with commas</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="salaryMin">
                            <Wallet className="w-3.5 h-3.5 inline mr-1" />
                            Min salary (LPA)
                          </Label>
                          <Input id="salaryMin" type="number" {...targetForm.register("salaryMinLpa")} />
                        </div>
                        <div>
                          <Label htmlFor="salaryMax">Max salary (LPA)</Label>
                          <Input id="salaryMax" type="number" {...targetForm.register("salaryMaxLpa")} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="notice">
                            <Clock className="w-3.5 h-3.5 inline mr-1" />
                            Notice period (days)
                          </Label>
                          <Input id="notice" type="number" {...targetForm.register("noticePeriodDays")} />
                        </div>
                        <div>
                          <Label htmlFor="jobType">Job type</Label>
                          <select
                            id="jobType"
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            {...targetForm.register("jobType")}
                          >
                            <option value="full-time">Full-time</option>
                            <option value="contract">Contract</option>
                            <option value="internship">Internship</option>
                            <option value="part-time">Part-time</option>
                            <option value="freelance">Freelance</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="workMode">
                          <Home className="w-3.5 h-3.5 inline mr-1" />
                          Work mode
                        </Label>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {(["remote", "hybrid", "onsite"] as const).map((m) => (
                            <label
                              key={m}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                                targetForm.watch("workMode") === m
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border hover:border-muted-foreground"
                              }`}
                            >
                              <input type="radio" value={m} {...targetForm.register("workMode")} className="sr-only" />
                              <span className="text-sm capitalize">{m}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Switch id="remoteOnly" {...targetForm.register("remoteOnly")} />
                        <Label htmlFor="remoteOnly" className="cursor-pointer">
                          Remote only — exclude onsite jobs
                        </Label>
                      </div>

                      <div className="flex justify-between pt-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                          <ChevronLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <Button type="submit">
                          Continue <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Step 3 ── */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-1">Connect your accounts</h2>
                      <p className="text-sm text-muted-foreground">
                        Log in through a secure cloud browser — your password never reaches our servers.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {[
                        { id: "linkedin", label: "LinkedIn", color: "bg-blue-500/10 border-blue-500/30 text-blue-400", Icon: Linkedin },
                        { id: "naukri", label: "Naukri", color: "bg-amber-500/10 border-amber-500/30 text-amber-400", Icon: Globe },
                      ].map((platform) => {
                        const connected = portalSessions[platform.id]?.status === "active";
                        return (
                          <div key={platform.id} className={`flex items-center justify-between p-4 border rounded-lg ${platform.color}`}>
                            <div className="flex items-center gap-3">
                              <platform.Icon className="w-5 h-5" />
                              <div>
                                <p className="font-medium text-foreground">{platform.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {connected ? "Connected" : "Secure browser login"}
                                </p>
                              </div>
                            </div>
                            {connected ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Check className="w-3 h-3 mr-1" /> Connected
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnect(platform.id)}
                                disabled={connectingPortal === platform.id}
                              >
                                {connectingPortal === platform.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Connect"
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <Shield className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          You&apos;ll log in through an isolated browser session. We only store session cookies — never your password.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="ghost" onClick={() => setStep(2)}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={saveStep3}>
                          Skip for now
                        </Button>
                        <Button onClick={saveStep3}>
                          Continue <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Step 4 ── */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8 space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-foreground mb-1">Application preferences</h2>
                      <p className="text-sm text-muted-foreground">Choose how aggressively JobBlitz applies on your behalf.</p>
                    </div>

                    <form onSubmit={prefForm.handleSubmit(handlePrefSubmit)} className="space-y-5">
                      <div>
                        <Label className="mb-2 block">Application mode</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {([
                            { value: "manual", label: "Manual", desc: "Discover + tailor, you apply yourself" },
                            { value: "assisted", label: "Assisted", desc: "AI prepares everything, you approve before submit" },
                            { value: "auto", label: "Auto", desc: "AI auto-applies for high-confidence matches" },
                          ] as const).map((m) => (
                            <label
                              key={m.value}
                              className={`flex flex-col gap-1 p-4 border rounded-lg cursor-pointer transition-colors ${
                                prefForm.watch("applicationMode") === m.value
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-muted-foreground"
                              }`}
                            >
                              <input type="radio" value={m.value} {...prefForm.register("applicationMode")} className="sr-only" />
                              <span className="text-sm font-semibold">{m.label}</span>
                              <span className="text-xs text-muted-foreground">{m.desc}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="dailyLimit" className="flex justify-between">
                          <span>Daily application target</span>
                          <span className="text-primary font-semibold">{prefForm.watch("dailyApplyLimit")}</span>
                        </Label>
                        <input
                          id="dailyLimit"
                          type="range"
                          min={1}
                          max={50}
                          {...prefForm.register("dailyApplyLimit")}
                          className="w-full mt-2 accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>1</span>
                          <span>50</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startHour">Preferred start time</Label>
                          <select
                            id="startHour"
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            {...prefForm.register("preferredStartHour")}
                          >
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="endHour">Preferred end time</Label>
                          <select
                            id="endHour"
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            {...prefForm.register("preferredEndHour")}
                          >
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-between pt-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                          <ChevronLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <Button type="submit">
                          Continue <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Step 5 ── */}
            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8 space-y-6 text-center">
                    {!discoveryDone ? (
                      <>
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-foreground mb-1">Ready to discover jobs</h2>
                          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            We&apos;ll scan LinkedIn and Naukri for roles matching your profile and preferences.
                          </p>
                        </div>

                        <div className="max-w-sm mx-auto space-y-3 text-left bg-muted rounded-lg p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary" />
                            <span>Resume parsed & profile saved</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary" />
                            <span>Target roles configured</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary" />
                            <span>Application mode: {prefForm.watch("applicationMode")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary" />
                            <span>Daily target: {prefForm.watch("dailyApplyLimit")} applications</span>
                          </div>
                        </div>

                        <Button onClick={startDiscovery} disabled={discovering} className="min-w-[180px]">
                          {discovering ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Discovering...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Run First Discovery
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                          <Check className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">You&apos;re all set!</h2>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          Your first discovery is running in the background. We&apos;ll notify you when new matches are ready.
                        </p>
                        <Button onClick={finishOnboarding} className="min-w-[180px]">
                          Go to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
