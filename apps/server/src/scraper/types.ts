import type { ExternalSiteKey } from "@peated/server/types";
import type { z } from "zod";

export type JsonValue =
  | boolean
  | JsonValue[]
  | null
  | number
  | string
  | { [key: string]: JsonValue };

export type ScraperRunPayload = JsonValue | undefined;

export type ScraperRequest = {
  target: string;
  url: URL;
  method?: "GET" | "POST";
  body?: string;
  headers?: Readonly<Record<string, string>>;
  /** Use only when another worker can safely continue this request. */
  canResumeLater?: boolean;
  /** Marks a read-only POST request as safe to retry after a temporary failure. */
  retryable?: boolean;
};

export type ScraperResponse = {
  url: URL;
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
};

export type ScraperObservation<T> = {
  /** Stable within a source so repeating saved work does not create duplicates. */
  sourceKey: string;
  /** Number of source items included when one save contains a limited batch. */
  itemCount?: number;
  value: T;
};

export interface ScraperSession<TCursor, TObservation> {
  request(input: ScraperRequest): Promise<ScraperResponse>;
  emit(observation: ScraperObservation<TObservation>): Promise<void>;
  checkpoint(cursor: TCursor): Promise<void>;
  remainingRequests(): number;
}

export type ScraperAdapter<TCursor, TObservation> = (input: {
  cursor: TCursor | null;
  session: ScraperSession<TCursor, TObservation>;
}) => Promise<void>;

export type ScraperSink<TObservation> = (input: {
  externalSiteId: number;
  observation: ScraperObservation<TObservation>;
}) => Promise<{
  newItemCount: number;
  existingItemCount: number;
} | void>;

export type ScraperSourceDefinition<TCursor = any, TObservation = any> = {
  key: string;
  externalSiteKey: ExternalSiteKey;
  recordType?: "review" | "price" | "catalog" | "bottle";
  targetKeys: readonly [string, ...string[]];
  requestLimit: number;
  resumeFromLastRun: boolean;
  cursorSchema: z.ZodType<TCursor>;
  observationSchema: z.ZodType<TObservation>;
  adapter: ScraperAdapter<TCursor, TObservation>;
  sink: ScraperSink<TObservation>;
};

type RobotsPolicy =
  | { mode: "enforce" }
  | { mode: "not_applicable"; rationale: string };

export type ScrapeOriginDefinition = {
  origin: string;
  robots: RobotsPolicy;
};

export type ScrapeTargetDefinition = {
  key: string;
  enabled: boolean;
  minimumSpacingMs: number;
  requestsPerWindow: number;
  windowMs: number;
  timeoutMs: number;
  maxResponseBytes: number;
  maxRetries: number;
  allowedRequestHeaders: readonly string[];
  origins: readonly [ScrapeOriginDefinition, ...ScrapeOriginDefinition[]];
};

export type ScraperRegistry = {
  sources: ReadonlyMap<string, ScraperSourceDefinition>;
  targets: ReadonlyMap<string, ScrapeTargetDefinition>;
};
