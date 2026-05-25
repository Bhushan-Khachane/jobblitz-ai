// Test setup: mock environment variables
process.env.BETTER_AUTH_SECRET = "test-secret-for-integration-tests-only";
process.env.API_URL = "http://localhost:8000";
process.env.WEB_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/jobblitz_test";
process.env.REDIS_URL = "redis://localhost:6379";
