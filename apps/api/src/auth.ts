import { createAuth } from "@jobblitz/auth";
import { db } from "./db";

export const auth = createAuth(db);
