import { env } from "cloudflare:workers";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const db: DrizzleD1Database<typeof schema> = drizzle(env.DB, { schema });
