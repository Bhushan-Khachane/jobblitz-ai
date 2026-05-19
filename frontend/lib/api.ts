import axios, { type AxiosInstance, type AxiosResponse } from "axios";

// ── Axios instance ──────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach JWT ─────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jb_access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: handle 401 ────────────────────────────────────────

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("jb_access_token");
      localStorage.removeItem("jb_refresh_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Response shapes ─────────────────────────────────────────────────────────

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  is_active: boolean;
  application_mode: string;
  daily_apply_limit: number;
  plan: string;
}

interface Profile {
  id: string;
  user_id: string;
  headline: string | null;
  summary: string | null;
  skills: string[] | null;
  experience: Record<string, unknown> | null;
  education: Record<string, unknown> | null;
  certifications: Record<string, unknown> | null;
  preferred_job_titles: string[] | null;
  preferred_locations: string[] | null;
  expected_salary_lpa: number | null;
  salary_min_lpa: number | null;
  salary_max_lpa: number | null;
  experience_level: string | null;
  remote_only: boolean;
  target_portals: string[] | null;
  notice_period_days: number | null;
  created_at: string;
  updated_at: string;
}

interface Resume {
  id: string;
  title: string;
  is_default: boolean;
  created_at: string;
}

interface JobSearch {
  id: string;
  name: string;
  platform: string;
  keywords: string;
  location: string | null;
  experience_level: string | null;
  job_type: string | null;
  remote_only: boolean;
  salary_min_lpa: number | null;
  salary_max_lpa: number | null;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

interface Application {
  id: string;
  job_listing_id: string;
  resume_id: string | null;
  status: string;
  approval_status: string | null;
  cover_letter: string | null;
  error_message: string | null;
  screenshot_path: string | null;
  retry_count: number;
  applied_at: string | null;
  created_at: string;
  // Enriched fields from approval queue endpoint
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
  apply_url?: string | null;
  fit_score?: number | null;
  gap_notes?: string | null;
  portal?: string | null;
}

interface AnalyticsOverview {
  total_applications: number;
  total_jobs_discovered: number;
  counts_by_status: { status: string; count: number }[];
  success_rate: number;
}

interface DailyStat {
  date: string;
  applications: number;
  discoveries: number;
}

interface CoverLetter {
  cover_letter: string;
}

interface Credential {
  id: string;
  platform: string;
  username: string;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Auth API ────────────────────────────────────────────────────────────────

export const authAPI = {
  login: (email: string, password: string) =>
    api.post<AuthTokens>("/auth/login", { email, password }).then((r) => r.data),

  register: (email: string, password: string, full_name: string, phone?: string) =>
    api.post<AuthTokens>("/auth/register", { email, password, full_name, phone }).then((r) => r.data),

  refresh: (refresh_token: string) =>
    api.post<AuthTokens>("/auth/refresh", { refresh_token }).then((r) => r.data),

  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

// ── Resumes API ─────────────────────────────────────────────────────────────

export const resumesAPI = {
  list: () => api.get<Resume[]>("/resumes").then((r) => r.data),

  upload: (file: File, title?: string, is_default?: boolean) => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    if (is_default != null) form.append("is_default", String(is_default));
    return api.post<Resume>("/resumes/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  setDefault: (id: string) =>
    api.put<Resume>(`/resumes/${id}`, { is_default: true }).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/resumes/${id}`).then((r) => r.data),
};

// ── Job Search API ──────────────────────────────────────────────────────────

export const jobSearchAPI = {
  list: () => api.get<JobSearch[]>("/job-searches/").then((r) => r.data),

  create: (data: Omit<JobSearch, "id" | "created_at" | "last_run_at" | "is_active">) =>
    api.post<JobSearch>("/job-searches/", data).then((r) => r.data),

  update: (id: string, data: Partial<JobSearch>) =>
    api.put<JobSearch>(`/job-searches/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/job-searches/${id}`).then((r) => r.data),

  toggle: (id: string, currentState: boolean) =>
    api.put<JobSearch>(`/job-searches/${id}`, { is_active: !currentState }).then((r) => r.data),

  run: (id: string) =>
    api.post<{ run_id: string; status: string; message: string }>(
      `/job-searches/${id}/run`
    ).then((r) => r.data),
};

// ── Discovery API ───────────────────────────────────────────────────────────

export const discoveryAPI = {
  run: (searchProfile: {
    keywords: string;
    location?: string;
    portal?: string;
    years_experience?: number;
    job_age_days?: number;
  }) =>
    api.post<{ run_id: string; status: string; events: unknown[] }>(
      "/discovery/run",
      { search_profile: searchProfile }
    ).then((r) => r.data),

  runDirect: (searchProfile: {
    keywords: string;
    location?: string;
    portal?: string;
    years_experience?: number;
    job_age_days?: number;
  }) =>
    api.post<{ run_id: string; status: string; events: unknown[] }>(
      "/discovery/run/direct",
      { search_profile: searchProfile }
    ).then((r) => r.data),

  jobLeads: (params?: { portal?: string; page?: number; page_size?: number }) =>
    api.get<{ items: unknown[]; total: number; page: number }>(
      "/discovery/job-leads",
      { params }
    ).then((r) => r.data),

  runSearch: (searchId: string) =>
    api.post<{ run_id: string; status: string }>(`/job-searches/${searchId}/run`).then((r) => r.data),

  getRunStatus: (runId: string) =>
    api.get<{
      status: string;
      events?: Record<string, unknown>[];
      pending_approvals?: number;
      error?: string | null;
    }>(`/discovery/run/${runId}/status`).then((r) => r.data),

  approveLead: (leadId: string) =>
    api.post<{ ok: boolean; decision: string }>(`/discovery/job-leads/${leadId}/decision`, { decision: "approve" }).then((r) => r.data),

  skipLead: (leadId: string) =>
    api.post<{ ok: boolean; decision: string }>(`/discovery/job-leads/${leadId}/decision`, { decision: "skip" }).then((r) => r.data),
};

// ── Applications API ────────────────────────────────────────────────────────

export const applicationsAPI = {
  list: (params?: { page?: number; per_page?: number; status?: string }) =>
    api.get<PaginatedResponse<Application>>("/applications", { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<Application>(`/applications/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    api.put<Application>(`/applications/${id}/status`, { status }).then((r) => r.data),

  approvalQueue: () =>
    api.get<Application[]>("/applications/me/approval-queue").then((r) => r.data),

  approve: (id: string) =>
    api.post<{ message: string; application_id: string }>(`/applications/${id}/approve`).then((r) => r.data),

  reject: (id: string) =>
    api.post<{ message: string; application_id: string }>(`/applications/${id}/reject`).then((r) => r.data),
};

// ── Analytics API ───────────────────────────────────────────────────────────

export const analyticsAPI = {
  overview: () =>
    api.get<AnalyticsOverview>("/analytics/overview").then((r) => r.data),

  dailyStats: (days?: number) =>
    api.get<DailyStat[]>("/analytics/daily-stats", { params: { days } }).then((r) => r.data),
};

// ── Cover Letters API ───────────────────────────────────────────────────────

export const coverLettersAPI = {
  generate: (data: { job_title: string; company: string; job_description?: string }) =>
    api.post<CoverLetter>("/cover-letters/generate", data).then((r) => r.data),
};

// ── Credentials API ─────────────────────────────────────────────────────────

export const credentialsAPI = {
  create: (data: { platform: string; username: string; password: string }) =>
    api.post<Credential>("/credentials", data).then((r) => r.data),

  list: () => api.get<Credential[]>("/credentials").then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/credentials/${id}`).then((r) => r.data),
};

// ── Users API ───────────────────────────────────────────────────────────────

export const usersAPI = {
  getMe: () => api.get<User>("/users/me").then((r) => r.data),

  updateMe: (data: Partial<Pick<User, "full_name" | "phone" | "location">>) =>
    api.put<User>("/users/me", data).then((r) => r.data),

  getProfile: () => api.get<Profile>("/users/me/profile").then((r) => r.data),

  updateProfile: (data: Record<string, unknown>) =>
    api.put<Profile>("/users/me/profile", data).then((r) => r.data),
};

// ── Portal Sessions API ─────────────────────────────────────────────────────

export const portalSessionsAPI = {
  list: () =>
    api.get<{ sessions: { portal: string; status: string; verified: boolean }[] }>("/portal-sessions/").then((r) => r.data),
};

// ── Default export: raw axios instance ──────────────────────────────────────

export default api;
