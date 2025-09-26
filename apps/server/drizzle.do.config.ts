import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	driver: "durable-sqlite",
	schema: "./src/do/schema/chat.ts",
	out: "./src/do/migrations",
});
