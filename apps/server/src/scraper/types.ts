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
  /** Explicitly marks a read-only POST query as safe for transient retries. */
  retryable?: boolean;
};

export type ScraperResponse = {
  url: URL;
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
};

export type ScraperObservation<T> = {
  /** Stable within a source so replay after a lost checkpoint is idempotent. */
  sourceKey: string;
  /** Number of source items represented when an adapter emits a bounded batch. */
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
}) => Promise<void>;

export type ScraperSourceDefinition<TCursor = any, TObservation = any> = {
  key: string;
  externalSiteKey: ExternalSiteKey;
  targetKeys: readonly [string, ...string[]];
  requestLimit: number;
  resumeFromLastRun: boolean;
  cursorSchema: z.ZodType<TCursor>;
  observationSchema: z.ZodType<TObservation>;
  adapter: ScraperAdapter<TCursor, TObservation>;
  sink: ScraperSink<TObservation>;
};

export type RobotsPolicy =
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
  policyException?: { rationale: string };
  origins: readonly [ScrapeOriginDefinition, ...ScrapeOriginDefinition[]];
};

export type ScraperRegistry = {
  sources: ReadonlyMap<string, ScraperSourceDefinition>;
  targets: ReadonlyMap<string, ScrapeTargetDefinition>;
};
