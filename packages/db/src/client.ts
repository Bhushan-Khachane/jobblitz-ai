import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export function createDatabaseClient(url: string) {
  const client = postgres(url, {
    prepare: false,
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export { schema };
