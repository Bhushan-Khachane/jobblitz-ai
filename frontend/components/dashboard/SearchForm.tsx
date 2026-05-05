"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  platform: z.enum(["linkedin", "naukri", "both"]),
  keywords: z.string().min(1, "Keywords are required"),
  location: z.string().optional(),
  experience_level: z.string().optional(),
  remote_only: z.boolean().default(false),
  salary_min_lpa: z.string().optional(),
  salary_max_lpa: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SearchFormProps {
  onSubmit: (data: FormValues) => void;
  defaultValues?: Partial<FormValues>;
  loading?: boolean;
}

export default function SearchForm({ onSubmit, defaultValues, loading }: SearchFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platform: "both",
      remote_only: false,
      ...defaultValues,
    },
  });

  const remoteOnly = watch("remote_only");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Search Name</Label>
        <Input id="name" placeholder="e.g. Senior React Jobs" {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label>Platform</Label>
        <Select onValueChange={(v) => setValue("platform", v as any)} defaultValue={defaultValues?.platform || "both"}>
          <SelectTrigger>
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="naukri">Naukri</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="keywords">Keywords</Label>
        <Input id="keywords" placeholder="React, TypeScript, Frontend" {...register("keywords")} />
        {errors.keywords && <p className="text-xs text-red-500 mt-1">{errors.keywords.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="Bangalore" {...register("location")} />
        </div>
        <div>
          <Label htmlFor="experience">Experience Level</Label>
          <Input id="experience" placeholder="2-5 years" {...register("experience_level")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="salary_min">Min Salary (LPA)</Label>
          <Input id="salary_min" type="number" placeholder="6" {...register("salary_min_lpa")} />
        </div>
        <div>
          <Label htmlFor="salary_max">Max Salary (LPA)</Label>
          <Input id="salary_max" type="number" placeholder="15" {...register("salary_max_lpa")} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={remoteOnly}
          onCheckedChange={(v) => setValue("remote_only", v)}
        />
        <Label>Remote only</Label>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : "Save Search"}
      </Button>
    </form>
  );
}
