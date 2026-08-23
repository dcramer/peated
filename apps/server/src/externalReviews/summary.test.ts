import config from "@peated/server/config";
import {
  EXTERNAL_REVIEW_SUMMARY_PROMPT_VERSION,
  type ExternalReviewSummaryServices,
  generateExternalReviewSummary,
} from "@peated/server/externalReviews/summary";
import { expect, test, vi } from "vitest";

function summaryServices() {
  const create =
    vi.fn<
      ReturnType<
        ExternalReviewSummaryServices["createClient"]
      >["responses"]["create"]
    >();
  const createClient = vi.fn<ExternalReviewSummaryServices["createClient"]>(
    () => ({ responses: { create } }),
  );
  const isConfigured = vi.fn(() => true);
  return {
    create,
    createClient,
    services: { createClient, isConfigured },
  };
}

function response(summary: string) {
  return {
    id: "response-1",
    model: "gpt-auxiliary-snapshot",
    service_tier: "default",
    output_text: JSON.stringify({ summary }),
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 50 },
      output_tokens: 40,
      output_tokens_details: { reasoning_tokens: 10 },
    },
  };
}

function input(externalSiteId: number, sourceText: string) {
  return {
    externalSiteId,
    sourceKey: "review-1",
    bottleName: "Example 12-year-old",
    sourceText,
    contentHash: "sha256:first",
  };
}

test("skips the model when the source does not permit LLM processing", async ({
  fixtures,
}) => {
  const { create, services } = summaryServices();
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.EnabledExternalReviewSourcePolicy({
    externalSiteId: site.id,
    allowLlmProcessing: false,
    allowSummaryDisplay: false,
  });

  await expect(
    generateExternalReviewSummary(input(site.id, "A useful review."), services),
  ).resolves.toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test("generates a short summary with provenance and no provider storage", async ({
  fixtures,
}) => {
  const { create, createClient, services } = summaryServices();
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.EnabledExternalReviewSourcePolicy({
    externalSiteId: site.id,
  });
  const sourceText =
    "The reviewer finds citrus and light smoke before a dry, balanced finish.";
  create.mockResolvedValue(
    response(
      "The reviewer describes a bright whisky with measured smoke. They find the finish dry and balanced.",
    ),
  );

  const result = await generateExternalReviewSummary(
    input(site.id, sourceText),
    services,
  );

  expect(result).toMatchObject({
    text: "The reviewer describes a bright whisky with measured smoke. They find the finish dry and balanced.",
    contentHash: "sha256:first",
    model: "gpt-auxiliary-snapshot",
    promptVersion: EXTERNAL_REVIEW_SUMMARY_PROMPT_VERSION,
    generatedAt: expect.any(Date),
  });
  expect(createClient).toHaveBeenCalledWith({
    instrumentWithSentry: false,
    workload: "scraper",
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      model: config.BOTTLE_CLASSIFIER_MODEL,
      store: false,
      max_output_tokens: 500,
      input: expect.stringContaining(sourceText),
    }),
  );
});

test("rejects output that does not contain two or three sentences", async ({
  fixtures,
}) => {
  const { create, services } = summaryServices();
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.EnabledExternalReviewSourcePolicy({
    externalSiteId: site.id,
  });
  const sourceText = "This source text must not appear in an error.";
  create.mockResolvedValue(response("The reviewer likes this whisky."));

  const error = await generateExternalReviewSummary(
    input(site.id, sourceText),
    services,
  ).catch((caught) => caught);

  expect(error).toMatchObject({
    name: "ExternalReviewSummaryError",
    message: "External review summary generation failed.",
  });
  expect(String(error)).not.toContain(sourceText);
});

test("rejects a long phrase copied from the publisher text", async ({
  fixtures,
}) => {
  const { create, services } = summaryServices();
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.EnabledExternalReviewSourcePolicy({
    externalSiteId: site.id,
  });
  const copiedPhrase =
    "the whisky opens with bright citrus soft smoke toasted grain and gentle spice";
  const sourceText = `${copiedPhrase} before a dry finish.`;
  create.mockResolvedValue(
    response(`The reviewer says ${copiedPhrase}. They also note a dry finish.`),
  );

  await expect(
    generateExternalReviewSummary(input(site.id, sourceText), services),
  ).rejects.toThrow("External review summary generation failed.");
});
