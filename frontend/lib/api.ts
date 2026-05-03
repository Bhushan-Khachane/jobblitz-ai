import axios, { type AxiosInstance, type AxiosResponse } from "axios";

// ── Axios instance ──────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
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
}

interface Resume {
  id: string;
  filename: string;
  file_url: string;
  is_default: boolean;
  uploaded_at: string;
}

interface JobSearch {
  id: string;
  title: string;
  location: string;
  platform: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Application {
  id: string;
  job_title: string;
  company: string;
  platform: string;
  status: string;
  applied_at: string;
  job_url: string | null;
  notes: string | null;
}

interface AnalyticsOverview {
  total_applications: number;
  interview_count: number;
  rejected_count: number;
  pending_count: number;
  success_rate: number;
}

interface DailyStat {
  date: string;
  count: number;
}

interface CoverLetter {
  id: string;
  job_title: string;
  company: string;
  content: string;
  created_at: string;
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
  per_page: number;
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

  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<Resume>("/resumes/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  setDefault: (id: string) =>
    api.put<Resume>(`/resumes/${id}/default`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/resumes/${id}`).then((r) => r.data),
};

// ── Job Search API ──────────────────────────────────────────────────────────

export const jobSearchAPI = {
  list: () => api.get<JobSearch[]>("/job-searches").then((r) => r.data),

  create: (data: Omit<JobSearch, "id" | "created_at" | "updated_at">) =>
    api.post<JobSearch>("/job-searches", data).then((r) => r.data),

  update: (id: string, data: Partial<JobSearch>) =>
    api.put<JobSearch>(`/job-searches/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/job-searches/${id}`).then((r) => r.data),

  toggle: (id: string) =>
    api.patch<JobSearch>(`/job-searches/${id}/toggle`).then((r) => r.data),
};

// ── Applications API ────────────────────────────────────────────────────────

export const applicationsAPI = {
  list: (params?: { page?: number; per_page?: number; status?: string }) =>
    api.get<PaginatedResponse<Application>>("/applications", { params }).then((r) => r.data),

  getById: (id: string) =>
    api.get<Application>(`/applications/${id}`).then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    api.patch<Application>(`/applications/${id}/status`, { status }).then((r) => r.data),
};

// ── Analytics API ───────────────────────────────────────────────────────────

export const analyticsAPI = {
  overview: () =>
    api.get<AnalyticsOverview>("/analytics/overview").then((r) => r.data),

  dailyStats: (days?: number) =>
    api.get<DailyStat[]>("/analytics/daily", { params: { days } }).then((r) => r.data),
};

// ── Cover Letters API ───────────────────────────────────────────────────────

export const coverLettersAPI = {
  generate: (data: { job_title: string; company: string; job_description?: string }) =>
    api.post<CoverLetter>("/cover-letters/generate", data).then((r) => r.data),

  list: () => api.get<CoverLetter[]>("/cover-letters").then((r) => r.data),
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
    api.patch<User>("/users/me", data).then((r) => r.data),

  getProfile: () => api.get<User>("/users/me/profile").then((r) => r.data),

  updateProfile: (data: Record<string, unknown>) =>
    api.patch<User>("/users/me/profile", data).then((r) => r.data),
};

// ── Default export: raw axios instance ──────────────────────────────────────

export default api;
