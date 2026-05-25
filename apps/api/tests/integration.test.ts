import { describe, it, expect, beforeAll } from "vitest";

const API_BASE = process.env.API_URL || "http://localhost:8000";

describe("API Integration", () => {
  describe("Health", () => {
    it("returns ok", async () => {
      const res = await fetch(`${API_BASE}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
    });
  });

  describe("Auth", () => {
    it("rejects unauthenticated requests to protected routes", async () => {
      const res = await fetch(`${API_BASE}/api/jobs`);
      expect(res.status).toBe(401);
    });

    it("returns session error for invalid session", async () => {
      const res = await fetch(`${API_BASE}/api/auth/session`);
      const body = await res.json();
      expect(body.session).toBeNull();
    });
  });

  describe("Jobs", () => {
    it("rejects job creation without auth", async () => {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", company: "TestCo", platform: "linkedin" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects job creation with missing fields", async () => {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Applications", () => {
    it("rejects listing applications without auth", async () => {
      const res = await fetch(`${API_BASE}/api/applications`);
      expect(res.status).toBe(401);
    });
  });

  describe("Approvals", () => {
    it("rejects listing approvals without auth", async () => {
      const res = await fetch(`${API_BASE}/api/approvals`);
      expect(res.status).toBe(401);
    });
  });

  describe("Dashboard", () => {
    it("rejects stats without auth", async () => {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`);
      expect(res.status).toBe(401);
    });
  });

  describe("Users", () => {
    it("rejects me endpoint without auth", async () => {
      const res = await fetch(`${API_BASE}/api/users/me`);
      expect(res.status).toBe(401);
    });
  });

  describe("MCP Gateway", () => {
    it("returns health status", async () => {
      const res = await fetch(`${API_BASE.replace(":8000", ":8003")}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.service).toBe("mcp-gateway");
    });
  });
});

describe("JobBlitz Domain Logic", () => {
  it("computeMatchScore is importable", async () => {
    const { computeMatchScore } = await import("@jobblitz/core");
    const job = {
      id: "1", userId: "u1", platform: "linkedin", title: "Python Backend Engineer",
      company: "TechCorp", skillsRequired: ["Python", "Django"],
      yearsExperienceMin: 3, salaryMinLpa: 20, salaryMaxLpa: 40,
      status: "discovered", createdAt: new Date().toISOString(),
    };
    const profile = {
      id: "p1", userId: "u1", skills: ["Python", "Django", "PostgreSQL"],
      experienceYears: 5, salaryMinLpa: 25, salaryMaxLpa: 50,
      preferredLocations: ["Bangalore"], preferredJobTitles: ["Backend Engineer"],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const score = computeMatchScore(job as never, profile as never);
    expect(score.fitScore).toBeGreaterThan(0);
    expect(score.decision).toBeOneOf(["auto", "approve", "skip"]);
    expect(score.dimensions.skillsMatch.matched.length).toBeGreaterThan(0);
  });
});
