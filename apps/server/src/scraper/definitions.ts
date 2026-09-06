import { REGISTERED_EXTERNAL_SITE_KEY_LIST } from "@peated/server/constants";
import type { RegisteredExternalSiteKey } from "@peated/server/types";
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

export const DEFAULT_SCRAPER_SETTINGS = Object.freeze({
  requestsPerHour: 60,
  requestLimit: 100,
  timeoutMs: 30_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRetries: 2,
});

const ONE_HOUR_MS = 60 * 60_000;

export function getHourlyRequestSettings(requestsPerHour: number) {
  return {
    minimumSpacingMs: Math.ceil(ONE_HOUR_MS / requestsPerHour),
    requestsPerWindow: requestsPerHour,
    windowMs: ONE_HOUR_MS,
  };
}

export function getRequestDelayMs(
  target: Pick<
    ScrapeTargetDefinition,
    "minimumSpacingMs" | "requestsPerWindow" | "windowMs"
  >,
) {
  return Math.max(
    target.minimumSpacingMs,
    Math.ceil(target.windowMs / target.requestsPerWindow),
  );
}

const DefinitionKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const ReasonSchema = z.string().trim().min(10).max(500);
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
      rationale: ReasonSchema,
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
    requestsPerHour: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_SCRAPER_SETTINGS.requestsPerHour),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_SCRAPER_SETTINGS.timeoutMs)
      .default(DEFAULT_SCRAPER_SETTINGS.timeoutMs),
    maxResponseBytes: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_SCRAPER_SETTINGS.maxResponseBytes)
      .default(DEFAULT_SCRAPER_SETTINGS.maxResponseBytes),
    maxRetries: z
      .number()
      .int()
      .min(0)
      .max(DEFAULT_SCRAPER_SETTINGS.maxRetries)
      .default(DEFAULT_SCRAPER_SETTINGS.maxRetries),
    allowedRequestHeaders: z.array(HeaderNameSchema).default([]),
    fasterRateReason: ReasonSchema.optional(),
    origins: z.tuple([OriginSchema], OriginSchema),
  })
  .strict()
  .superRefine((target, context) => {
    if (
      target.requestsPerHour > DEFAULT_SCRAPER_SETTINGS.requestsPerHour &&
      !target.fasterRateReason
    ) {
      context.addIssue({
        code: "custom",
        message: "A higher hourly request limit requires a reason.",
        path: ["fasterRateReason"],
      });
    }
  });

const ZodSchemaSchema = z.custom<z.ZodType>(
  (value) => value instanceof z.ZodType,
  "Expected a Zod schema.",
);

const FunctionSchema = z.function();

const SourceDefinitionSchema = z
  .object({
    key: DefinitionKeySchema,
    externalSiteKey: z.enum(REGISTERED_EXTERNAL_SITE_KEY_LIST),
    targetKeys: z.tuple([DefinitionKeySchema], DefinitionKeySchema),
    requestLimit: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_SCRAPER_SETTINGS.requestLimit)
      .default(DEFAULT_SCRAPER_SETTINGS.requestLimit),
    resumeFromLastRun: z.boolean().default(false),
    cursorSchema: ZodSchemaSchema,
    observationSchema: ZodSchemaSchema,
    adapter: FunctionSchema,
    sink: FunctionSchema,
  })
  .strict();

export type BuiltInScraperSourceDefinition<
  TCursor = any,
  TObservation = any,
> = Omit<ScraperSourceDefinition<TCursor, TObservation>, "externalSiteKey"> & {
  externalSiteKey: RegisteredExternalSiteKey;
};

export function defineScrapeTarget(
  input: z.input<typeof TargetDefinitionSchema>,
): ScrapeTargetDefinition {
  const {
    requestsPerHour,
    fasterRateReason: _,
    ...target
  } = TargetDefinitionSchema.parse(input);
  return {
    ...target,
    ...getHourlyRequestSettings(requestsPerHour),
  };
}

export function defineScraperSource<TCursor, TObservation>(
  input: Omit<
    BuiltInScraperSourceDefinition<TCursor, TObservation>,
    "requestLimit" | "resumeFromLastRun"
  > & {
    requestLimit?: number;
    resumeFromLastRun?: boolean;
  },
): BuiltInScraperSourceDefinition<TCursor, TObservation> {
  const parsed = SourceDefinitionSchema.parse(input);
  return {
    ...input,
    requestLimit: parsed.requestLimit,
    resumeFromLastRun: parsed.resumeFromLastRun,
  };
}

export function createScraperRegistry(input: {
  targets: readonly ScrapeTargetDefinition[];
  sources: readonly BuiltInScraperSourceDefinition[];
}): ScraperRegistry {
  const targets = new Map<string, ScrapeTargetDefinition>();
  const originOwners = new Map<string, string>();
  for (const target of input.targets) {
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
    const existingOwner = externalSiteOwners.get(source.externalSiteKey);
    if (existingOwner) {
      throw new Error(
        `External site ${source.externalSiteKey} belongs to both ${existingOwner} and ${source.key}.`,
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
    externalSiteOwners.set(source.externalSiteKey, source.key);
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

export function findScraperSourceBySiteKey(
  registry: ScraperRegistry,
  externalSiteKey: string,
) {
  return [...registry.sources.values()].find(
    (source) => source.externalSiteKey === externalSiteKey,
  );
}

/** A disabled built-in target cannot start or continue a scrape. */
export function requireEnabledScraperTargets(
  registry: ScraperRegistry,
  source: ScraperSourceDefinition,
) {
  for (const targetKey of source.targetKeys) {
    const target = registry.targets.get(targetKey);
    if (!target?.enabled) throw new ScraperTargetDisabledError(targetKey);
  }
}
