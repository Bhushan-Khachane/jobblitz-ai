from locust import HttpUser, task, between
import random
import string


def rand_email():
    return "load_" + "".join(random.choices(string.ascii_lowercase, k=8)) + "@test.com"


class JobBlitzUser(HttpUser):
    wait_time = between(0.5, 2)
    host = "http://localhost:8000"
    token = None

    def on_start(self):
        """Register + login once per simulated user."""
        email = rand_email()
        pw = "Load1234!"
        # Register
        self.client.post("/api/v1/auth/register", json={
            "email": email, "password": pw, "full_name": "Load User"
        })
        # Login
        resp = self.client.post("/api/v1/auth/login", json={"email": email, "password": pw})
        if resp.status_code == 200:
            self.token = resp.json().get("access_token")

    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def get_me(self):
        self.client.get("/api/v1/users/me", headers=self.auth_headers(), name="/me")

    @task(3)
    def list_applications(self):
        self.client.get("/api/v1/applications/?page=1&per_page=10",
                        headers=self.auth_headers(), name="/applications")

    @task(2)
    def list_job_searches(self):
        self.client.get("/api/v1/job-searches/",
                        headers=self.auth_headers(), name="/job-searches")

    @task(2)
    def analytics(self):
        self.client.get("/api/v1/analytics/overview",
                        headers=self.auth_headers(), name="/analytics")

    @task(1)
    def health_check(self):
        self.client.get("/health", name="/health")

    @task(1)
    def refresh_token(self):
        self.client.get("/api/v1/users/me", headers=self.auth_headers(), name="/me-refresh")
