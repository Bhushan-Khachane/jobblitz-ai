import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DatabaseClient } from "@jobblitz/db";

export function createAuth(db: DatabaseClient) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    secret: process.env.BETTER_AUTH_SECRET!,
    baseUrl: process.env.API_URL!,
    advanced: {
      cookiePrefix: "jb",
      generateId: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 300, // 5 minutes
      },
    },
    rateLimit: {
      window: 60, // 1 minute
      max: 10,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      linkedin: {
        clientId: process.env.LINKEDIN_CLIENT_ID!,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      },
    },
    trustedOrigins: [process.env.WEB_URL!],
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
