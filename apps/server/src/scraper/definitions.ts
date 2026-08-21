import { EXTERNAL_SITE_TYPE_LIST } from "@peated/server/constants";
import type { ExternalSiteType } from "@peated/server/types";
import { z } from "zod";
import type {
  ScrapeOriginDefinition,
  ScraperRegistry,
  ScraperSourceDefinition,
  ScrapeTargetDefinition,
} from "./types";

export class ScraperTargetDisabledError extends Error {
  override name = "ScraperTargetDisabledError";

  constructor(readonly targetKey: string) {
    super(`Scraper target ${targetKey} is disabled.`);
  }
}

export const DEFAULT_SCRAPER_REQUEST_POLICY = Object.freeze({
  minimumSpacingMs: 2_000,
  requestsPerWindow: 60,
  windowMs: 60 * 60_000,
  requestLimit: 100,
  timeoutMs: 30_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRetries: 2,
});

const DefinitionKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const RationaleSchema = z.string().trim().min(10).max(500);
const HeaderNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+$/)
  .refine(
    (name) =>
      !["cookie", "host", "content-length", "proxy-authorization"].includes(
        name,
      ),
    "Unsafe scraper request header.",
  );

const RobotsPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("enforce") }).strict(),
  z
    .object({
      mode: z.literal("not_applicable"),
      rationale: RationaleSchema,
    })
    .strict(),
]);

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Scraper origin must be an exact HTTP origin: ${value}`);
  }
  return url.origin;
}

const OriginSchema = z
  .object({
    origin: z.string().url().transform(normalizeOrigin),
    robots: RobotsPolicySchema,
  })
  .strict();

const TargetDefinitionSchema = z
  .object({
    key: DefinitionKeySchema,
    enabled: z.boolean().default(true),
    minimumSpacingMs: z
      .number()
      .int()
      .nonnegative()
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.minimumSpacingMs),
    requestsPerWindow: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.requestsPerWindow),
    windowMs: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.windowMs),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_SCRAPER_REQUEST_POLICY.timeoutMs)
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.timeoutMs),
    maxResponseBytes: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_SCRAPER_REQUEST_POLICY.maxResponseBytes)
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.maxResponseBytes),
    maxRetries: z
      .number()
      .int()
      .min(0)
      .max(DEFAULT_SCRAPER_REQUEST_POLICY.maxRetries)
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.maxRetries),
    allowedRequestHeaders: z.array(HeaderNameSchema).default([]),
    policyException: z
      .object({ rationale: RationaleSchema })
      .strict()
      .optional(),
    origins: z.tuple([OriginSchema], OriginSchema),
  })
  .strict()
  .superRefine((target, context) => {
    const isLessRestrictive =
      target.minimumSpacingMs <
        DEFAULT_SCRAPER_REQUEST_POLICY.minimumSpacingMs ||
      target.requestsPerWindow >
        DEFAULT_SCRAPER_REQUEST_POLICY.requestsPerWindow ||
      target.windowMs < DEFAULT_SCRAPER_REQUEST_POLICY.windowMs;
    if (isLessRestrictive && !target.policyException) {
      context.addIssue({
        code: "custom",
        message: "A less restrictive target policy requires a rationale.",
        path: ["policyException"],
      });
    }
  });

const ZodSchemaSchema = z.custom<z.ZodType>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "safeParse" in value &&
    typeof value.safeParse === "function",
  "Expected a Zod schema.",
);

const FunctionSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
  "Expected a function.",
);

const SourceDefinitionSchema = z
  .object({
    key: DefinitionKeySchema,
    externalSiteType: z.enum(EXTERNAL_SITE_TYPE_LIST),
    targetKeys: z.tuple([DefinitionKeySchema], DefinitionKeySchema),
    requestLimit: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_SCRAPER_REQUEST_POLICY.requestLimit)
      .default(DEFAULT_SCRAPER_REQUEST_POLICY.requestLimit),
    cursorSchema: ZodSchemaSchema,
    observationSchema: ZodSchemaSchema,
    adapter: FunctionSchema,
    sink: FunctionSchema,
  })
  .strict();

export function defineScrapeTarget(
  input: Omit<
    ScrapeTargetDefinition,
    | "enabled"
    | "minimumSpacingMs"
    | "requestsPerWindow"
    | "windowMs"
    | "timeoutMs"
    | "maxResponseBytes"
    | "maxRetries"
    | "allowedRequestHeaders"
  > &
    Partial<
      Pick<
        ScrapeTargetDefinition,
        | "enabled"
        | "minimumSpacingMs"
        | "requestsPerWindow"
        | "windowMs"
        | "timeoutMs"
        | "maxResponseBytes"
        | "maxRetries"
        | "allowedRequestHeaders"
      >
    >,
): ScrapeTargetDefinition {
  return TargetDefinitionSchema.parse(input) as ScrapeTargetDefinition;
}

export function defineScraperSource<TCursor, TObservation>(
  input: Omit<
    ScraperSourceDefinition<TCursor, TObservation>,
    "requestLimit"
  > & {
    requestLimit?: number;
  },
): ScraperSourceDefinition<TCursor, TObservation> {
  return SourceDefinitionSchema.parse(
    input,
  ) as unknown as ScraperSourceDefinition<TCursor, TObservation>;
}

export function createScraperRegistry(input: {
  targets: readonly ScrapeTargetDefinition[];
  sources: readonly ScraperSourceDefinition[];
}): ScraperRegistry {
  const targets = new Map<string, ScrapeTargetDefinition>();
  const originOwners = new Map<string, string>();
  for (const value of input.targets) {
    const target = defineScrapeTarget(value);
    if (targets.has(target.key)) {
      throw new Error(`Duplicate scraper target: ${target.key}`);
    }
    for (const origin of target.origins) {
      const existingOwner = originOwners.get(origin.origin);
      if (existingOwner) {
        throw new Error(
          `Scraper origin ${origin.origin} belongs to both ${existingOwner} and ${target.key}.`,
        );
      }
      originOwners.set(origin.origin, target.key);
    }
    targets.set(target.key, target);
  }

  const sources = new Map<string, ScraperSourceDefinition>();
  const externalSiteOwners = new Map<string, string>();
  for (const value of input.sources) {
    const source = defineScraperSource(value);
    if (sources.has(source.key)) {
      throw new Error(`Duplicate scraper source: ${source.key}`);
    }
    const existingOwner = externalSiteOwners.get(source.externalSiteType);
    if (existingOwner) {
      throw new Error(
        `External site ${source.externalSiteType} belongs to both ${existingOwner} and ${source.key}.`,
      );
    }
    for (const targetKey of source.targetKeys) {
      if (!targets.has(targetKey)) {
        throw new Error(
          `Scraper source ${source.key} references unknown target ${targetKey}.`,
        );
      }
    }
    sources.set(source.key, source);
    externalSiteOwners.set(source.externalSiteType, source.key);
  }

  return { sources, targets };
}

export function resolveScraperOrigin(
  registry: ScraperRegistry,
  sourceKey: string,
  targetKey: string,
  url: URL,
): ScrapeOriginDefinition {
  const source = registry.sources.get(sourceKey);
  if (!source) throw new Error(`Unknown scraper source: ${sourceKey}`);
  if (!source.targetKeys.includes(targetKey)) {
    throw new Error(
      `Scraper source ${sourceKey} may not use target ${targetKey}.`,
    );
  }
  const target = registry.targets.get(targetKey);
  if (!target) throw new Error(`Unknown scraper target: ${targetKey}`);
  const origin = target.origins.find((item) => item.origin === url.origin);
  if (!origin) {
    throw new Error(
      `Origin ${url.origin} is not declared for scraper target ${targetKey}.`,
    );
  }
  return origin;
}

export function findScraperSourceBySiteType(
  registry: ScraperRegistry,
  externalSiteType: ExternalSiteType,
) {
  return [...registry.sources.values()].find(
    (source) => source.externalSiteType === externalSiteType,
  );
}

/** Disabled code-owned targets cannot create or execute durable scraper work. */
export function requireEnabledScraperTargets(
  registry: ScraperRegistry,
  source: ScraperSourceDefinition,
) {
  for (const targetKey of source.targetKeys) {
    const target = registry.targets.get(targetKey);
    if (!target?.enabled) throw new ScraperTargetDisabledError(targetKey);
  }
}
