import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal .env loader for standalone scripts (tsx, prisma.config.ts).
 * Next.js loads these files itself; scripts don't. Later files never
 * override earlier ones, and real environment variables always win.
 */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    let raw: string;
    try {
      raw = readFileSync(resolve(process.cwd(), file), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}
