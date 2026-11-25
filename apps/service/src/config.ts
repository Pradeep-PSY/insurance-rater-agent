import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().url().superRefine((value, ctx) => {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      ctx.addIssue({ code: "custom", message: "DATABASE_URL must use PostgreSQL." });
    }
    if (["allow", "prefer", "require"].includes(url.searchParams.get("sslmode") ?? "")) {
      ctx.addIssue({ code: "custom", message: "DATABASE_URL must not use a TLS mode without certificate verification." });
    }
  }),
  REVIEWER_ACCESS_TOKEN: z.string().min(32),
  S3_BUCKET: z.string().min(3),
  S3_REGION: z.string().min(1),
  S3_ENDPOINT: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
  PORT: z.coerce.number().int().positive().default(8080),
  WORKSPACE_ID: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).default("shared-reviewer"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().max(52_428_800).default(26_214_400),
  PDF_MAX_PAGES: z.coerce.number().int().positive().max(500).default(100),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().max(300).default(60),
  OCR_PROVIDER: z.enum(["disabled"]).default("disabled"),
  POLICY_FACT_PROVIDER: z.enum(["disabled"]).default("disabled"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid service configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}
