"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Briefcase, Shield, ChevronRight, ChevronLeft, Check, Zap, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";

const steps = [
  { id: 1, title: "Upload Resume", icon: Upload },
  { id: 2, title: "Job Preferences", icon: Briefcase },
  { id: 3, title: "Connect Accounts", icon: Shield },
];

const prefSchema = z.object({
  keywords: z.string().min(1, "Enter at least one keyword"),
  location: z.string().optional(),
  experience_level: z.string().optional(),
  salary_expectation: z.string().optional(),
  job_type: z.enum(["full-time", "contract", "remote", "hybrid"]).default("full-time"),
});

type PrefValues = z.infer<typeof prefSchema>;

export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const prefForm = useForm<PrefValues>({
    resolver: zodResolver(prefSchema),
    defaultValues: { job_type: "full-time" },
  });

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
      setStep(2);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [resumeFile]);

  const handlePrefSubmit = async (data: PrefValues) => {
    try {
      await api.put("/users/me/profile", {
        preferred_job_titles: data.keywords.split(",").map((s) => s.trim()),
        preferred_locations: data.location ? [data.location] : [],
        expected_salary_lpa: data.salary_expectation ? parseFloat(data.salary_expectation) : null,
      });
      setStep(3);
    } catch {
      setStep(3);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">JobBlitz</span>
      </div>

      {/* Stepper */}
      <div className="max-w-xl mx-auto w-full px-6 mt-4 mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step > s.id
                      ? "bg-primary-500 text-primary-foreground"
                      : step === s.id
                      ? "bg-primary-500 text-primary-foreground ring-4 ring-primary-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.id ? <Check className="w-5 h-5" /> : s.id}
                </div>
                <span className="text-xs font-medium text-muted-foreground mt-2">{s.title}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-20 sm:w-32 h-0.5 mx-3 mt-[-20px] ${step > s.id ? "bg-primary-500" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {/* Step 1: Resume Upload */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold text-foreground mb-2">Upload your resume</h2>
                    <p className="text-sm text-muted-foreground mb-6">We'll parse it to auto-fill your profile and tailor it for each job.</p>

                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors mb-6 ${
                        dragging ? "border-primary-500 bg-primary-500/5" : "border-border"
                      }`}
                    >
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">Drag & drop your PDF resume here</p>
                      <label className="inline-block cursor-pointer">
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setResumeFile(f); }} />
                        <span className="text-sm font-medium text-primary-500 hover:underline">or browse files</span>
                      </label>
                    </div>

                    {resumeFile && (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-6">
                        <Upload className="w-5 h-5 text-primary-500" />
                        <span className="text-sm text-foreground flex-1 truncate">{resumeFile.name}</span>
                        <Badge variant="secondary">{(resumeFile.size / 1024).toFixed(0)} KB</Badge>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(2)}>
                        Skip for now <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                      <Button onClick={handleResumeUpload} disabled={!resumeFile || uploading}>
                        {uploading ? "Uploading..." : "Upload & Continue"} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 2: Job Preferences */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold text-foreground mb-2">Job preferences</h2>
                    <p className="text-sm text-muted-foreground mb-6">Tell us what you're looking for so we can find the best matches.</p>

                    <form onSubmit={prefForm.handleSubmit(handlePrefSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="keywords">Job titles / Keywords</Label>
                        <Input id="keywords" placeholder="React Developer, Frontend Engineer" {...prefForm.register("keywords")} />
                        {prefForm.formState.errors.keywords && (
                          <p className="text-xs text-destructive mt-1">{prefForm.formState.errors.keywords.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="location">Preferred Location</Label>
                          <Input id="location" placeholder="Bangalore" {...prefForm.register("location")} />
                        </div>
                        <div>
                          <Label htmlFor="experience">Experience Level</Label>
                          <Input id="experience" placeholder="2-5 years" {...prefForm.register("experience_level")} />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="salary">Salary Expectation (LPA)</Label>
                        <Input id="salary" type="number" placeholder="12" {...prefForm.register("salary_expectation")} />
                      </div>

                      <div>
                        <Label>Job Type</Label>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {(["full-time", "contract", "remote", "hybrid"] as const).map((t) => (
                            <label
                              key={t}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                                prefForm.watch("job_type") === t
                                  ? "border-primary-500 bg-primary-500/10 text-primary-500"
                                  : "border-border hover:border-muted-foreground"
                              }`}
                            >
                              <input type="radio" value={t} {...prefForm.register("job_type")} className="sr-only" />
                              <span className="text-sm capitalize">{t}</span>
                            </label>
                          ))}
                        </div>
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

            {/* Step 3: Connect Accounts via Neko (zero-password) */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card>
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold text-foreground mb-2">Connect your accounts</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Log in through a secure cloud browser — your password never reaches our servers.
                    </p>

                    <div className="space-y-4">
                      {[
                        { id: "linkedin", label: "LinkedIn", color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
                        { id: "naukri", label: "Naukri", color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
                      ].map((platform) => (
                        <div
                          key={platform.id}
                          className={`flex items-center justify-between p-4 border rounded-lg ${platform.color}`}
                        >
                          <div>
                            <p className="font-medium capitalize text-foreground">{platform.label}</p>
                            <p className="text-xs text-muted-foreground">Secure browser login</p>
                          </div>
                          <a
                            href={`/connect/${platform.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-primary-500 text-primary-foreground rounded-lg text-sm hover:bg-primary-600 flex items-center gap-1"
                          >
                            Connect <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 p-3 bg-primary-500/5 rounded-lg border border-primary-500/20">
                        <Shield className="w-4 h-4 text-primary-500 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          You'll log in through an isolated browser session. We only store session cookies — never your password.
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">
                        You can also skip this step and connect later from Settings.
                      </p>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button onClick={() => router.push("/dashboard")}>
                        Go to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
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