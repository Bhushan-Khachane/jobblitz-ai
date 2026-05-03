"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, profileRes, resumeRes] = await Promise.all([
          api.get("/users/me"),
          api.get("/users/me/profile").catch(() => ({ data: null })),
          api.get("/resumes/"),
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
    // Toggle by re-uploading with is_default
    await api.put(`/resumes/${id}`, { is_default: true }).catch(() => {});
    const res = await api.get("/resumes/");
    setResumes(res.data || []);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>
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
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {skills.length === 0 && <p className="text-sm text-gray-400">No skills added yet</p>}
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
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_default && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>
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
    </motion.div>
  );
}
