import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const manifestSourceSchema = z
  .object({
    sourceId: z.string().min(1).optional(),
    insurerId: z
      .enum([
        "HDFC_ERGO",
        "GO_DIGIT",
        "RELIANCE_INDUSIND",
        "TATA_AIG",
        "UNKNOWN",
      ])
      .optional(),
    fileName: z.string().min(1).optional(),
    relativePath: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    sha256: z
      .string()
      .regex(
        /^[a-fA-F0-9]{64}$/,
        "SHA-256 must contain exactly 64 hexadecimal characters",
      )
      .optional(),
    bytes: z
      .number()
      .int()
      .positive("Manifest byte count must be a positive integer")
      .optional(),
    byteSize: z.number().int().nonnegative().optional(),
    byteLength: z.number().int().nonnegative().optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const actualManifestEntrySchema = z
  .object({
    path: z
      .string()
      .min(1, "Manifest file path must not be empty")
      .refine(
        (value) =>
          !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value),
        "Manifest file path must be relative",
      )
      .refine(
        (value) => !value.replace(/\\/g, "/").split("/").includes(".."),
        "Manifest file path cannot contain traversal components",
      )
      .refine(
        (value) => !value.includes("\0"),
        "Manifest file path cannot contain null bytes",
      ),
    bytes: z
      .number()
      .int()
      .positive("Manifest byte count must be a positive integer"),
    sha256: z
      .string()
      .regex(
        /^[a-fA-F0-9]{64}$/,
        "SHA-256 must contain exactly 64 hexadecimal characters",
      ),
  })
  .strict();

export const actualManifestSchema = z
  .object({
    formatVersion: z
      .number()
      .int()
      .positive("formatVersion must be a positive integer"),
    contents: z.record(z.string(), z.unknown()),
    files: z.array(actualManifestEntrySchema),
  })
  .strict();

export const manifestSchema = z.union([
  actualManifestSchema,
  z.array(manifestSourceSchema),
  z
    .object({
      sources: z.array(manifestSourceSchema),
    })
    .passthrough(),
  z.record(z.string(), manifestSourceSchema),
]);

export type ManifestSource = z.infer<typeof manifestSourceSchema>;
export type ActualManifestEntry = z.infer<typeof actualManifestEntrySchema>;
export type ActualManifest = z.infer<typeof actualManifestSchema>;

export type GridParseDisposition =
  | "PARSE_XLSX"
  | "PARSE_PDF"
  | "VERIFY_ONLY_SAMPLE_POLICY"
  | "VERIFY_ONLY_NON_GRID"
  | "UNSUPPORTED_EXTENSION"
  | "UNKNOWN_PATH"
  | "NOT_PARSED_INTEGRITY_FAILED";

export interface ManifestVerificationRecord {
  sourceId: string;
  insurerId:
    | "HDFC_ERGO"
    | "GO_DIGIT"
    | "RELIANCE_INDUSIND"
    | "TATA_AIG"
    | "UNKNOWN";
  relativePath: string;
  absolutePath: string;
  gridParseDisposition: GridParseDisposition;
  listedSha256: string | null;
  actualSha256: string | null;
  listedByteSize: number | null;
  actualByteSize: number | null;
  hashMatches: boolean;
  byteSizeMatches: boolean;
  exists: boolean;
  status: "PASS" | "FAIL";
  error: string | null;
}

export function isPathInsideSourceRoot(
  sourceRoot: string,
  relativePath: string,
): boolean {
  if (!relativePath || relativePath.includes("\0")) return false;
  if (
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  )
    return false;

  const normalizedRelative = relativePath.replace(/\\/g, "/");
  if (normalizedRelative.split("/").includes("..")) return false;

  const absoluteRoot = path.resolve(sourceRoot);
  const absolutePath = path.resolve(absoluteRoot, normalizedRelative);
  return (
    absolutePath === absoluteRoot ||
    absolutePath.startsWith(`${absoluteRoot}${path.sep}`)
  );
}

export function getGridParseDisposition(
  relativePath: string,
  integrityStatus: "PASS" | "FAIL",
): GridParseDisposition {
  if (integrityStatus !== "PASS") return "NOT_PARSED_INTEGRITY_FAILED";

  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("raters/")) {
    const extension = path.posix.extname(normalized).toLowerCase();
    if (extension === ".xlsx" || extension === ".xlsm") return "PARSE_XLSX";
    if (extension === ".pdf") return "PARSE_PDF";
    return "UNSUPPORTED_EXTENSION";
  }
  if (normalized.startsWith("sample-policies/")) {
    return "VERIFY_ONLY_SAMPLE_POLICY";
  }
  if (normalized === "README.md" || normalized === "challenge.md") {
    return "VERIFY_ONLY_NON_GRID";
  }
  return "UNKNOWN_PATH";
}

function normalizeEntries(
  parsed: z.infer<typeof manifestSchema>,
): ManifestSource[] {
  const actual = actualManifestSchema.safeParse(parsed);
  if (actual.success) {
    return actual.data.files.map((entry) => ({
      path: entry.path,
      bytes: entry.bytes,
      sha256: entry.sha256,
    }));
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && "sources" in parsed) {
    const withSources = parsed as { sources: ManifestSource[] };
    return withSources.sources;
  }
  if (parsed && typeof parsed === "object")
    return Object.entries(parsed).map(([key, value]) => ({
      sourceId: key,
      ...(value as ManifestSource),
    }));
  return [];
}

export async function verifyManifest(
  manifestPath: string,
  sourceRoot: string,
): Promise<{
  entries: ManifestVerificationRecord[];
  manifestFound: boolean;
  manifestError: string | null;
  formatVersion: number | null;
  contents: Record<string, unknown> | null;
}> {
  let manifestText: string;
  try {
    manifestText = await readFile(manifestPath, "utf8");
  } catch (error) {
    return {
      entries: [],
      manifestFound: false,
      manifestError: error instanceof Error ? error.message : String(error),
      formatVersion: null,
      contents: null,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(manifestText);
  } catch (error) {
    return {
      entries: [],
      manifestFound: true,
      manifestError: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      formatVersion: null,
      contents: null,
    };
  }

  const parsed = manifestSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      entries: [],
      manifestFound: true,
      manifestError: `Invalid MANIFEST.json: ${parsed.error.issues
        .map((issue) => {
          const location =
            issue.path.length > 0 ? issue.path.join(".") : "manifest";
          return `${location}: ${issue.message}`;
        })
        .join("; ")}`,
      formatVersion: null,
      contents: null,
    };
  }

  const records: ManifestVerificationRecord[] = [];
  const actualManifest = actualManifestSchema.safeParse(parsedJson);
  const formatVersion = actualManifest.success
    ? actualManifest.data.formatVersion
    : null;
  const contents = actualManifest.success ? actualManifest.data.contents : null;
  let resolvedSourceRoot: string | null = null;
  try {
    resolvedSourceRoot = await realpath(sourceRoot);
  } catch {
    resolvedSourceRoot = null;
  }

  for (const entry of normalizeEntries(parsed.data)) {
    const relativePath =
      entry.relativePath ?? entry.path ?? entry.fileName ?? "";
    const safeRelativePath = relativePath.replace(/\\/g, "/");
    const absolutePath = relativePath
      ? path.resolve(sourceRoot, safeRelativePath)
      : path.resolve(sourceRoot);
    const listedByteSize =
      "bytes" in entry
        ? ((entry as ManifestSource & { bytes?: number }).bytes ?? null)
        : (entry.byteSize ?? entry.byteLength ?? entry.size ?? null);
    let actualSha256: string | null = null;
    let actualByteSize: number | null = null;
    let exists = false;
    let error: string | null = null;

    if (!relativePath) {
      error = "Manifest entry has no path.";
    } else if (!isPathInsideSourceRoot(sourceRoot, relativePath)) {
      error = "Manifest path traversal or absolute path is not allowed.";
    } else {
      try {
        const fileStat = await stat(absolutePath);
        exists = fileStat.isFile();
        if (!exists) {
          error = "Listed source path is not a file.";
        } else {
          if (resolvedSourceRoot !== null) {
            const resolvedFile = await realpath(absolutePath);
            if (
              resolvedFile !== resolvedSourceRoot &&
              !resolvedFile.startsWith(`${resolvedSourceRoot}${path.sep}`)
            ) {
              exists = false;
              error = "Manifest path resolves outside the source root.";
            }
          }
        }
        if (exists) {
          actualByteSize = fileStat.size;
          const bytes = await readFile(absolutePath);
          actualSha256 = createHash("sha256").update(bytes).digest("hex");
        }
      } catch (readError) {
        error =
          readError instanceof Error ? readError.message : String(readError);
      }
    }

    const hashMatches =
      entry.sha256 !== undefined &&
      actualSha256 !== null &&
      entry.sha256.toLowerCase() === actualSha256;
    const byteSizeMatches =
      listedByteSize !== null &&
      actualByteSize !== null &&
      listedByteSize === actualByteSize;

    const integrityStatus: "PASS" | "FAIL" =
      exists &&
      entry.sha256 !== undefined &&
      hashMatches &&
      listedByteSize !== null &&
      byteSizeMatches
        ? "PASS"
        : "FAIL";

    records.push({
      sourceId: entry.sourceId ?? path.basename(relativePath),
      insurerId: entry.insurerId ?? "UNKNOWN",
      relativePath,
      absolutePath,
      gridParseDisposition: getGridParseDisposition(
        relativePath,
        integrityStatus,
      ),
      listedSha256: entry.sha256?.toLowerCase() ?? null,
      actualSha256,
      listedByteSize,
      actualByteSize,
      hashMatches,
      byteSizeMatches,
      exists,
      status: integrityStatus,
      error,
    });
  }
  return {
    entries: records,
    manifestFound: true,
    manifestError: null,
    formatVersion,
    contents,
  };
}
