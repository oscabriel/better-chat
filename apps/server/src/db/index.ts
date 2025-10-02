import { env } from "cloudflare:workers";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./schema/auth";
import * as usageSchema from "./schema/usage";

const schema = { ...authSchema, ...usageSchema };

export type Database = DrizzleD1Database<typeof schema>;

export const db: Database = drizzle(env.DB, { schema });
