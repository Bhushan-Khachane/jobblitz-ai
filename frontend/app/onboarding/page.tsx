"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Briefcase, Key, ChevronRight, ChevronLeft, Check, Zap } from "lucide-react";
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
  { id: 3, title: "Platform Credentials", icon: Key },
];

const prefSchema = z.object({
  keywords: z.string().min(1, "Enter at least one keyword"),
  location: z.string().optional(),
  experience_level: z.string().optional(),
  salary_expectation: z.string().optional(),
  job_type: z.enum(["full-time", "contract", "remote", "hybrid"]).default("full-time"),
});

const credSchema = z.object({
  linkedin_email: z.string().optional(),
  linkedin_password: z.string().optional(),
  naukri_email: z.string().optional(),
  naukri_password: z.string().optional(),
});

type PrefValues = z.infer<typeof prefSchema>;
type CredValues = z.infer<typeof credSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const prefForm = useForm<PrefValues>({
    resolver: zodResolver(prefSchema),
    defaultValues: { job_type: "full-time" },
  });

  const credForm = useForm<CredValues>({ resolver: zodResolver(credSchema) });

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
      setStep(3); // Continue anyway
    }
  };

  const handleCredSubmit = async (data: CredValues) => {
    try {
      if (data.linkedin_email && data.linkedin_password) {
        await api.post("/credentials/", {
          platform: "linkedin",
          username: data.linkedin_email,
          password: data.linkedin_password,
        });
      }
      if (data.naukri_email && data.naukri_password) {
        await api.post("/credentials/", {
          platform: "naukri",
          username: data.naukri_email,
          password: data.naukri_password,
        });
      }
    } catch {
      // Continue to dashboard
    }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">JobBlitz</span>
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
                      ? "bg-indigo-600 text-white"
                      : step === s.id
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step > s.id ? <Check className="w-5 h-5" /> : s.id}
                </div>
                <span className="text-xs font-medium text-gray-600 mt-2">{s.title}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-20 sm:w-32 h-0.5 mx-3 mt-[-20px] ${step > s.id ? "bg-indigo-600" : "bg-gray-200"}`} />
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
                <Card className="shadow-lg border-0">
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Upload your resume</h2>
                    <p className="text-sm text-gray-500 mb-6">We'll parse it to auto-fill your profile and tailor it for each job.</p>

                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors mb-6 ${
                        dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300"
                      }`}
                    >
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-2">Drag & drop your PDF resume here</p>
                      <label className="inline-block cursor-pointer">
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setResumeFile(f); }} />
                        <span className="text-sm font-medium text-indigo-600 hover:underline">or browse files</span>
                      </label>
                    </div>

                    {resumeFile && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-6">
                        <Upload className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm text-gray-700 flex-1 truncate">{resumeFile.name}</span>
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
                <Card className="shadow-lg border-0">
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Job preferences</h2>
                    <p className="text-sm text-gray-500 mb-6">Tell us what you're looking for so we can find the best matches.</p>

                    <form onSubmit={prefForm.handleSubmit(handlePrefSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="keywords">Job titles / Keywords</Label>
                        <Input id="keywords" placeholder="React Developer, Frontend Engineer" {...prefForm.register("keywords")} />
                        {prefForm.formState.errors.keywords && (
                          <p className="text-xs text-red-500 mt-1">{prefForm.formState.errors.keywords.message}</p>
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
                                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                  : "border-gray-200 hover:border-gray-300"
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

            {/* Step 3: Credentials */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card className="shadow-lg border-0">
                  <CardContent className="p-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connect your accounts</h2>
                    <p className="text-sm text-gray-500 mb-6">We need your login credentials to auto-apply on your behalf. Encrypted with AES-256.</p>

                    <form onSubmit={credForm.handleSubmit(handleCredSubmit)} className="space-y-6">
                      {/* LinkedIn */}
                      <div className="p-4 bg-blue-50 rounded-xl">
                        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">in</div>
                          LinkedIn
                        </h3>
                        <div className="space-y-3">
                          <Input placeholder="Email or phone" {...credForm.register("linkedin_email")} />
                          <Input type="password" placeholder="Password" {...credForm.register("linkedin_password")} />
                        </div>
                      </div>

                      {/* Naukri */}
                      <div className="p-4 bg-yellow-50 rounded-xl">
                        <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                          <div className="w-6 h-6 bg-yellow-600 rounded flex items-center justify-center text-white text-xs font-bold">N</div>
                          Naukri
                        </h3>
                        <div className="space-y-3">
                          <Input placeholder="Email" {...credForm.register("naukri_email")} />
                          <Input type="password" placeholder="Password" {...credForm.register("naukri_password")} />
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed">
                        🔒 Your credentials are encrypted with AES-256 (Fernet) before storage. We never log or share your passwords.
                        You can revoke access anytime from your dashboard.
                      </p>

                      <div className="flex justify-between pt-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                          <ChevronLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <Button type="submit">
                          Finish & Go to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </form>
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
