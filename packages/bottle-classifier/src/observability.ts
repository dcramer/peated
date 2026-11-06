/**
 * Owns classifier span metadata. The AI SDK traces each agent run, model call,
 * and tool call on its own, with complete input and output, so one run reads as
 * one agent in Sentry. This span only groups that run and adds classifier facts
 * such as the source and the initial candidate count. It must not repeat the
 * AI SDK's agent, tool, or token-usage data. Recording never changes a result:
 * with no active span, it does nothing.
 */
import {
  getActiveSpan,
  startSpan as startSentrySpan,
  type Span,
} from "@sentry/core";
import type { BottleClassificationResult } from "./contract";

export type ClassifierSpanAttributes = Record<
  string,
  boolean | number | string | string[] | undefined
>;

export function buildClassifierRunSpanContext({
  name,
  conversationId,
  attributes = {},
}: {
  name: string;
  conversationId: string;
  attributes?: ClassifierSpanAttributes;
}) {
  return {
    op: "bottle_classifier.run",
    name,
    attributes: {
      "gen_ai.conversation.id": conversationId,
      ...attributes,
    },
  };
}

export type ClassifierSpanContext = ReturnType<
  typeof buildClassifierRunSpanContext
>;

export type ClassifierSpanStarter = <T>(
  context: ClassifierSpanContext,
  callback: (span: Span) => Promise<T>,
) => Promise<T>;

const defaultClassifierSpanStarter: ClassifierSpanStarter = async (
  context,
  callback,
) => await startSentrySpan(context, callback);

/** Groups one classifier run under its caller-owned conversation id. */
export async function startClassifierRunSpan<T>({
  name,
  conversationId,
  attributes = {},
  callback,
  startSpan = defaultClassifierSpanStarter,
}: {
  name: string;
  conversationId: string;
  attributes?: ClassifierSpanAttributes;
  callback: () => Promise<T>;
  startSpan?: ClassifierSpanStarter;
}): Promise<T> {
  return await startSpan(
    buildClassifierRunSpanContext({ name, conversationId, attributes }),
    async () => await callback(),
  );
}

/**
 * What settled a reference run: a rule or the scope pre-check ignored it, an
 * exact SMWS code or an accepted Bottle Reference matched it, or the agent
 * decided.
 */
export type ReferenceRunPath =
  | "rule"
  | "scope_precheck"
  | "smws_code"
  | "exact_reference"
  | "agent";

/**
 * Records how a reference run ended on the caller's active span, so production
 * outcomes can be counted in Sentry by path, action, and open risk. Only fixed
 * values are recorded, never source text or reasons.
 */
export function recordReferenceRunOutcome({
  path,
  result,
  span = getActiveSpan(),
}: {
  path: ReferenceRunPath;
  result: BottleClassificationResult;
  span?: Pick<Span, "setAttributes">;
}) {
  if (!span) return;
  const decision = result.status === "classified" ? result.decision : null;
  span.setAttributes({
    "bottle_classifier.path": path,
    "bottle_classifier.status": result.status,
    "bottle_classifier.action": decision?.action ?? "ignore",
    "bottle_classifier.identity_scope": decision?.identityScope ?? undefined,
    "bottle_classifier.web_evidence":
      decision?.confidenceBasis?.webEvidence ?? undefined,
    // Sentry keeps only text and numbers on spans, so a list is one sorted,
    // comma-joined value that groups the same way every time.
    "bottle_classifier.risk_categories": decision?.confidenceBasis
      ? [
          ...new Set(
            decision.confidenceBasis.unresolvedRisks.map(
              ({ category }) => category,
            ),
          ),
        ]
          .sort()
          .join(",") || "none"
      : undefined,
    "bottle_classifier.risk_count":
      decision?.confidenceBasis?.unresolvedRisks.length ?? 0,
    "bottle_classifier.candidate_count": result.artifacts.candidates.length,
  });
}
