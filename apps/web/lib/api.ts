import axios, { type AxiosInstance, type AxiosResponse } from "axios";

// ── Axios instance ──────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// ── Response interceptor: handle 401 ────────────────────────────────────────

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: User;
}

export interface Job {
  id: string;
  userId: string;
  platform: string;
  externalJobId?: string | null;
  title: string;
  company: string;
  location?: string | null;
  description?: string | null;
  requirements?: string[] | null;
  responsibilities?: string[] | null;
  skillsRequired?: string[] | null;
  experienceLevel?: string | null;
  yearsExperienceMin?: number | null;
  yearsExperienceMax?: number | null;
  salaryMinLpa?: number | null;
  salaryMaxLpa?: number | null;
  jobType?: string | null;
  remotePolicy?: string | null;
  applyUrl?: string | null;
  postedDate?: string | null;
  status: string;
  matchScore?: number | null;
  matchExplanation?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  resumeId?: string | null;
  coverLetterId?: string | null;
  status: string;
  approvalStatus?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  appliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    location?: string | null;
  };
}

export interface Approval {
  id: string;
  status: string;
  fitScore?: number | null;
  reason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    location?: string | null;
  };
}

export interface DashboardStats {
  totalJobs: number;
  totalApplications: number;
  pendingApprovals: number;
  avgMatchScore: number;
}

export interface Profile {
  id: string;
  userId: string;
  headline?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  experience?: unknown[] | null;
  education?: unknown[] | null;
  certifications?: unknown[] | null;
  experienceYears?: number | null;
  experienceLevel?: string | null;
  salaryMinLpa?: number | null;
  salaryMaxLpa?: number | null;
  expectedSalaryLpa?: number | null;
  currentCtcLpa?: number | null;
  preferredLocations?: string[] | null;
  preferredJobTitles?: string[] | null;
  targetPortals?: string[] | null;
  noticePeriodDays?: number | null;
  remoteOnly?: boolean | null;
  languages?: string[] | null;
  jobType?: string | null;
  workMode?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  parsedProfile?: unknown | null;
  onboardingStep?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Auth API (Better Auth) ──────────────────────────────────────────────────

export const authAPI = {
  signIn: (email: string, password: string) =>
    api.post("/api/auth/sign-in/email", { email, password }).then((r) => r.data),

  signUp: (email: string, password: string, name: string) =>
    api.post("/api/auth/sign-up/email", { email, password, name }).then((r) => r.data),

  signOut: () => api.post("/api/auth/sign-out").then((r) => r.data),

  session: () => api.get<{ session: Session | null; user: User | null }>("/api/auth/session").then((r) => r.data),
};

// ── Jobs API ────────────────────────────────────────────────────────────────

export const jobsAPI = {
  list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) =>
    api.get<Job[]>("/api/jobs", { params }).then((r) => r.data),

  getById: (id: string) => api.get<Job>(`/api/jobs/${id}`).then((r) => r.data),

  create: (data: Omit<Job, "id" | "userId" | "status" | "matchScore" | "matchExplanation" | "createdAt" | "updatedAt">) =>
    api.post<Job>("/api/jobs", data).then((r) => r.data),

  update: (id: string, data: Partial<Job>) =>
    api.patch<Job>(`/api/jobs/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/api/jobs/${id}`).then((r) => r.data),

  score: (id: string) => api.post<{ fitScore: number; decision: string; dimensions: Record<string, unknown> }>(`/api/jobs/${id}/score`).then((r) => r.data),

  discover: () =>
    api.post<{ taskId: string; estimatedSeconds: number }>("/api/jobs/discover").then((r) => r.data),

  apply: (jobId: string) =>
    api.post<{ queued: boolean; position: number }>(`/api/jobs/${jobId}/apply`).then((r) => r.data),

  dismiss: (jobId: string) =>
    api.delete(`/api/jobs/${jobId}`).then((r) => r.data),
};

// Legacy alias for compatibility
export type JobRecommendation = Job;

// ── Applications API ────────────────────────────────────────────────────────

export const applicationsAPI = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<Application[]>("/api/applications", { params }).then((r) => r.data),

  getById: (id: string) => api.get<Application>(`/api/applications/${id}`).then((r) => r.data),

  create: (data: { jobId: string; resumeId?: string; coverLetterId?: string }) =>
    api.post<Application>("/api/applications", data).then((r) => r.data),

  update: (id: string, data: Partial<Application>) =>
    api.patch<Application>(`/api/applications/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/api/applications/${id}`).then((r) => r.data),

  // Legacy compatibility stubs
  approvalQueue: () => api.get<Application[]>("/api/applications", { params: { status: "pending" } }).then((r) => r.data),
  approve: (id: string) => api.patch<Application>(`/api/applications/${id}`, { status: "approved" }).then((r) => r.data),
  reject: (id: string) => api.patch<Application>(`/api/applications/${id}`, { status: "rejected" }).then((r) => r.data),
  answerQuestions: (id: string, answers: { question: string; answer: string }[]) =>
    api.post<{ message: string; application_id: string; saved: number }>(`/api/applications/${id}/answer-questions`, { answers }).then((r) => r.data),
};

// ── Approvals API ───────────────────────────────────────────────────────────

export const approvalsAPI = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<Approval[]>("/api/approvals", { params }).then((r) => r.data),

  approve: (id: string) => api.post<Approval>(`/api/approvals/${id}/approve`).then((r) => r.data),

  reject: (id: string) => api.post<Approval>(`/api/approvals/${id}/reject`).then((r) => r.data),
};

// ── Dashboard API ───────────────────────────────────────────────────────────

export const dashboardAPI = {
  stats: () => api.get<DashboardStats>("/api/dashboard/stats").then((r) => r.data),
};

// ── Users API ───────────────────────────────────────────────────────────────

export const usersAPI = {
  me: () => api.get<{ user: User; profile: Profile | null }>("/api/users/me").then((r) => r.data),

  updateMe: (data: Record<string, unknown>) =>
    api.patch<{ user: User; profile: Profile | null }>("/api/users/me", data).then((r) => r.data),
};

export interface JobSearch {
  id: string;
  name: string;
  platform: string;
  keywords: string;
  location?: string | null;
  experienceLevel?: string | null;
  jobType?: string | null;
  remoteOnly: boolean;
  salaryMinLpa?: number | null;
  salaryMaxLpa?: number | null;
  isActive: boolean;
  lastRunAt?: string | null;
  createdAt: string;
}

export interface Credential {
  id: string;
  platform: string;
  username: string;
  createdAt: string;
}

export interface PortalSession {
  portal: string;
  status: string;
  verified: boolean;
}

export const jobSearchAPI = {
  list: () => api.get<JobSearch[]>("/api/searches").then((r) => r.data),
  create: (data: Omit<JobSearch, "id" | "createdAt" | "lastRunAt" | "isActive">) =>
    api.post<JobSearch>("/api/searches", data).then((r) => r.data),
  update: (id: string, data: Partial<JobSearch>) =>
    api.patch<JobSearch>(`/api/searches/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/searches/${id}`).then((r) => r.data),
  toggle: (id: string, currentState: boolean) =>
    api.patch<JobSearch>(`/api/searches/${id}`, { isActive: !currentState }).then((r) => r.data),
};

export const credentialsAPI = {
  list: () => api.get<Credential[]>("/api/credentials").then((r) => r.data),
  create: (data: { platform: string; username: string; password: string }) =>
    api.post<Credential>("/api/credentials", data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/credentials/${id}`).then((r) => r.data),
};

export const portalSessionsAPI = {
  list: () => api.get<{ sessions: PortalSession[] }>("/api/portals/sessions").then((r) => r.data),
};

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  digestFrequency: string;
  followUpEnabled: boolean;
  applicationUpdates: boolean;
  marketing: boolean;
  createdAt: string;
  updatedAt: string;
}

export const notificationsAPI = {
  preferences: () => api.get<NotificationPreferences | null>("/api/v1/notifications/preferences").then((r) => r.data),
  updatePreferences: (data: Partial<NotificationPreferences>) =>
    api.put<NotificationPreferences>("/api/v1/notifications/preferences", data).then((r) => r.data),
};

export const discoveryAPI = {
  run: (profile: { keywords: string; location?: string; portal?: string; yearsExperience?: number; jobAgeDays?: number }) =>
    api.post<{ taskId: string; status: string }>("/api/discovery/run", profile).then((r) => r.data),

  runDirect: (profile: { keywords: string; location?: string; portal?: string; yearsExperience?: number; jobAgeDays?: number }) =>
    api.post<{ taskId: string; status: string }>("/api/discovery/run-direct", profile).then((r) => r.data),

  jobLeads: (params?: { portal?: string; page?: number; pageSize?: number }) =>
    api.get<{ items: unknown[]; total: number; page: number }>("/api/discovery/leads", { params }).then((r) => r.data),

  approveLead: (leadId: string) =>
    api.post<{ ok: boolean; decision: string }>(`/api/discovery/leads/${leadId}/approve`).then((r) => r.data),

  skipLead: (leadId: string) =>
    api.post<{ ok: boolean; decision: string }>(`/api/discovery/leads/${leadId}/skip`).then((r) => r.data),

  runSearch: (searchId: string) =>
    api.post<{ taskId: string; status: string }>(`/api/searches/${searchId}/run`).then((r) => r.data),
};

export default api;
