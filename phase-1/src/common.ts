import { z } from "zod";

/** Monetary values and percentages are decimal strings to avoid JS float drift. */
export const decimalStringSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/, "Expected a decimal string, e.g. '17.50'.");

export const nonNegativeDecimalStringSchema = decimalStringSchema.refine(
  (value) => !value.startsWith("-"),
  "Value must be non-negative.",
);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date.");

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const currencyCodeSchema = z.enum(["INR"]);

export const moneySchema = z.object({
  amount: decimalStringSchema,
  currency: currencyCodeSchema,
}).strict();

export const insurerCodeSchema = z.enum([
  "HDFC_ERGO",
  "GO_DIGIT",
  "RELIANCE_INDUSIND",
  "TATA_AIG",
  "OTHER",
]);

export const businessTypeSchema = z.enum([
  "NEW_BUSINESS",
  "RENEWAL",
  "ROLLOVER",
  "UNKNOWN",
]);

export const fuelTypeSchema = z.enum([
  "PETROL",
  "DIESEL",
  "CNG",
  "LPG",
  "ELECTRIC",
  "HYBRID",
  "OTHER",
]);

export const policyTypeSchema = z.enum([
  "COMPREHENSIVE",
  "STANDALONE_TP",
  "STANDALONE_OD",
  "UNKNOWN",
]);

export const coverageComponentSchema = z.enum(["OD", "TP", "PACKAGE"]);

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export type DecimalString = z.infer<typeof decimalStringSchema>;
export type Money = z.infer<typeof moneySchema>;
export type InsurerCode = z.infer<typeof insurerCodeSchema>;
export type BusinessType = z.infer<typeof businessTypeSchema>;
export type FuelType = z.infer<typeof fuelTypeSchema>;
export type PolicyType = z.infer<typeof policyTypeSchema>;
