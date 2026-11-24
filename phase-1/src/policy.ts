import { z } from "zod";
import {
  businessTypeSchema,
  decimalStringSchema,
  fuelTypeSchema,
  isoDateSchema,
  insurerCodeSchema,
  moneySchema,
  policyTypeSchema,
  type Money,
} from "./common.js";
import { factSchema, type Fact } from "./fact.js";

const textFact = factSchema(z.string().min(1));
const dateFact = factSchema(isoDateSchema);
const moneyFact = factSchema(moneySchema);
const percentageFact = factSchema(decimalStringSchema);

const insurerIdentitySchema = z.object({
  code: insurerCodeSchema,
  displayName: z.string().min(1),
}).strict();

const rtoSchema = z.object({
  code: z.string().min(2),
  city: z.string().optional(),
  state: z.string().optional(),
}).strict();

const geographySchema = z.object({
  rto: factSchema(rtoSchema).optional(),
  state: textFact.optional(),
  city: textFact.optional(),
  zone: textFact.optional(),
  marketType: textFact.optional(),
}).strict();

const premiumComponentSchema = z.object({
  label: z.string().min(1),
  amount: moneyFact,
  evidenceState: z.enum(["KNOWN", "MISSING", "INVALID", "AMBIGUOUS"]).optional(),
}).strict();

const previousPolicySchema = z.object({
  insurer: factSchema(insurerIdentitySchema),
  policyType: factSchema(policyTypeSchema).optional(),
  expiryDate: dateFact.optional(),
  coverGapDays: factSchema(z.number().int().nonnegative()).optional(),
  claimStatus: textFact.optional(),
  ncbPercent: percentageFact.optional(),
}).strict();

export interface InsurerIdentity {
  code: z.infer<typeof insurerCodeSchema>;
  displayName: string;
}

export interface RtoFacts {
  code: string;
  city?: string | undefined;
  state?: string | undefined;
}

export interface VehicleFacts {
  make: Fact<string>;
  model: Fact<string>;
  variant: Fact<string>;
  registrationNumber?: Fact<string> | undefined;
  bodyType?: Fact<string> | undefined;
  fuel: Fact<z.infer<typeof fuelTypeSchema>>;
  rto: Fact<RtoFacts>;
  engineCapacityCC: Fact<number>;
  manufactureYear: Fact<number>;
  registrationDate: Fact<string>;
  vehicleAgeYears: Fact<string>;
  geography?: {
    rto?: Fact<RtoFacts> | undefined;
    state?: Fact<string> | undefined;
    city?: Fact<string> | undefined;
    zone?: Fact<string> | undefined;
    marketType?: Fact<string> | undefined;
  } | undefined;
}

export interface PolicyDetailsFacts {
  type: Fact<z.infer<typeof policyTypeSchema>>;
  issueDate: Fact<string>;
  loginDate: Fact<string>;
  coverStartDate: Fact<string>;
  coverEndDate: Fact<string>;
  previousPolicyExpiryDate: Fact<string>;
  ncbPercent: Fact<string>;
  previousNcbPercent: Fact<string>;
  intermediaryCode?: Fact<string> | undefined;
  producerCode?: Fact<string> | undefined;
  proposalRenewalMarked?: Fact<boolean> | undefined;
  previousPolicy?: {
    insurer: Fact<InsurerIdentity>;
    policyType?: Fact<z.infer<typeof policyTypeSchema>> | undefined;
    expiryDate?: Fact<string> | undefined;
    coverGapDays?: Fact<number> | undefined;
    claimStatus?: Fact<string> | undefined;
    ncbPercent?: Fact<string> | undefined;
  } | undefined;
  coverageGap?: {
    hasGap?: Fact<boolean> | undefined;
    gapStartDate?: Fact<string> | undefined;
    gapEndDate?: Fact<string> | undefined;
    gapDays?: Fact<number> | undefined;
  } | undefined;
}

export interface PremiumFacts {
  currency: "INR";
  odNetPremium: Fact<Money>;
  tpLiabilityNetPremium: Fact<Money>;
  odComponents?: Array<{ label: string; amount: Fact<Money>; evidenceState?: "KNOWN" | "MISSING" | "INVALID" | "AMBIGUOUS" | undefined }> | undefined;
  tpComponents?: Array<{ label: string; amount: Fact<Money>; evidenceState?: "KNOWN" | "MISSING" | "INVALID" | "AMBIGUOUS" | undefined }> | undefined;
  paComponents?: Array<{ label: string; amount: Fact<Money>; evidenceState?: "KNOWN" | "MISSING" | "INVALID" | "AMBIGUOUS" | undefined }> | undefined;
  legalLiabilityComponents?: Array<{ label: string; amount: Fact<Money>; evidenceState?: "KNOWN" | "MISSING" | "INVALID" | "AMBIGUOUS" | undefined }> | undefined;
  addOnComponents?: Array<{ label: string; amount: Fact<Money>; evidenceState?: "KNOWN" | "MISSING" | "INVALID" | "AMBIGUOUS" | undefined }> | undefined;
  hdfcPackageAggregate?: {
    odNetPremium: Fact<Money>;
    tpLiabilityNetPremium: Fact<Money>;
    eligibleTotalNetPremium: Fact<Money>;
    gstExcluded: Fact<true>;
    comprehensiveAndSaodGwp?: Fact<Money> | undefined;
    satpPremiumExcluded?: Fact<true> | undefined;
  } | undefined;
  relevantGwp?: Fact<Money> | undefined;
  slabBasisGwp?: Fact<Money> | undefined;
  addOnsNetPremium: Fact<Money>;
  otherNetPremium: Fact<Money>;
  totalNetPremium: Fact<Money>;
  gst: Fact<Money>;
  grossPayable: Fact<Money>;
}

export interface PolicyFactsShape {
  schemaVersion: "1.0.0";
  policyDocumentId: string;
  insurer: Fact<InsurerIdentity>;
  previousInsurer: Fact<InsurerIdentity>;
  businessType: Fact<z.infer<typeof businessTypeSchema>>;
  vehicle: VehicleFacts;
  policy: PolicyDetailsFacts;
  premium: PremiumFacts;
  extraction: {
    method: "PDF_TEXT" | "OCR" | "MIXED" | "MANUAL_REVIEW";
    extractorVersion: string;
    promptVersion?: string | undefined;
    processedAt: string;
  };
}

const policyFactsShape = z.object({
  schemaVersion: z.literal("1.0.0"),
  policyDocumentId: z.string().min(1),
  insurer: factSchema(insurerIdentitySchema),
  previousInsurer: factSchema(insurerIdentitySchema),
  businessType: factSchema(businessTypeSchema),
  vehicle: z.object({
    make: textFact,
    model: textFact,
    variant: textFact,
    registrationNumber: textFact.optional(),
    bodyType: textFact.optional(),
    fuel: factSchema(fuelTypeSchema),
    rto: factSchema(rtoSchema),
    engineCapacityCC: factSchema(z.number().positive()),
    manufactureYear: factSchema(z.number().int().min(1900).max(2100)),
    registrationDate: dateFact,
    vehicleAgeYears: factSchema(decimalStringSchema),
    geography: geographySchema.optional(),
  }).strict(),
  policy: z.object({
    type: factSchema(policyTypeSchema),
    issueDate: dateFact,
    loginDate: dateFact,
    coverStartDate: dateFact,
    coverEndDate: dateFact,
    previousPolicyExpiryDate: dateFact,
    ncbPercent: percentageFact,
    previousNcbPercent: percentageFact,
    intermediaryCode: textFact.optional(),
    producerCode: textFact.optional(),
    proposalRenewalMarked: factSchema(z.boolean()).optional(),
    previousPolicy: previousPolicySchema.optional(),
    coverageGap: z.object({
      hasGap: factSchema(z.boolean()).optional(),
      gapStartDate: dateFact.optional(),
      gapEndDate: dateFact.optional(),
      gapDays: factSchema(z.number().int().nonnegative()).optional(),
    }).strict().optional(),
  }).strict(),
  premium: z.object({
    currency: z.literal("INR"),
    odNetPremium: moneyFact,
    tpLiabilityNetPremium: moneyFact,
    odComponents: z.array(premiumComponentSchema).optional(),
    tpComponents: z.array(premiumComponentSchema).optional(),
    paComponents: z.array(premiumComponentSchema).optional(),
    legalLiabilityComponents: z.array(premiumComponentSchema).optional(),
    addOnComponents: z.array(premiumComponentSchema).optional(),
    hdfcPackageAggregate: z.object({
      odNetPremium: moneyFact,
      tpLiabilityNetPremium: moneyFact,
      eligibleTotalNetPremium: moneyFact,
      gstExcluded: factSchema(z.literal(true)),
      comprehensiveAndSaodGwp: moneyFact.optional(),
      satpPremiumExcluded: factSchema(z.literal(true)).optional(),
    }).strict().optional(),
    relevantGwp: moneyFact.optional(),
    slabBasisGwp: moneyFact.optional(),
    addOnsNetPremium: moneyFact,
    otherNetPremium: moneyFact,
    totalNetPremium: moneyFact,
    gst: moneyFact,
    grossPayable: moneyFact,
  }).strict(),
  extraction: z.object({
    method: z.enum(["PDF_TEXT", "OCR", "MIXED", "MANUAL_REVIEW"]),
    extractorVersion: z.string().min(1),
    promptVersion: z.string().optional(),
    processedAt: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export const policyFactsSchema: z.ZodType<
  PolicyFactsShape,
  z.ZodTypeDef,
  PolicyFactsShape
> = policyFactsShape;
export type PolicyFacts = PolicyFactsShape;
