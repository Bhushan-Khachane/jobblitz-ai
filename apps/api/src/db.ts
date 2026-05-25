import { createDatabaseClient } from "@jobblitz/db";
import { validateSecrets } from "@jobblitz/security";

const secrets = validateSecrets(process.env);

export const db = createDatabaseClient(secrets.DATABASE_URL);
