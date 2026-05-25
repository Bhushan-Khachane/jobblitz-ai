import { createDatabaseClient } from "@jobblitz/db";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://jobblitz:jobblitz@localhost:5432/jobblitz";

export const db = createDatabaseClient(DATABASE_URL);
