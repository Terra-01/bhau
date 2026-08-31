import { defineConfig } from "prisma/config";
import { loadEnv } from "./src/lib/load-env";

loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Placeholder keeps `prisma generate` working before a database exists;
    // migrate/db commands need the real DATABASE_URL in .env.local.
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/thefloor",
  },
});
