import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./app/db/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
});
