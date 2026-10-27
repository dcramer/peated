import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { OpenAICountryDetailsSchema } from "../worker/jobs/generateCountryDetails";
import { OpenAIEntityDetailsValidationSchema } from "../worker/jobs/generateEntityDetails";
import { OpenAIRegionDetailsSchema } from "../worker/jobs/generateRegionDetails";
import { buildStructuredResponseSpanContext } from "./openai";

test("uses GenAI workflow semantics for structured responses", () => {
  expect(
    buildStructuredResponseSpanContext(
      "getGeneratedEntityDetails",
      "gpt-5.6-terra",
    ),
  ).toEqual({
    op: "gen_ai.invoke_workflow",
    name: "invoke_workflow getGeneratedEntityDetails",
    attributes: {
      "gen_ai.operation.name": "invoke_workflow",
      "gen_ai.provider.name": "openai",
      "gen_ai.workflow.name": "getGeneratedEntityDetails",
      "gen_ai.request.model": "gpt-5.6-terra",
      "gen_ai.output.type": "json",
    },
  });
});

describe("openai structured output schemas", () => {
  test("compile to strict json schema without optional fields", () => {
    expect(() =>
      zodTextFormat(
        OpenAIEntityDetailsValidationSchema,
        "generate_entity_details",
      ),
    ).not.toThrow();
    expect(() =>
      zodTextFormat(OpenAICountryDetailsSchema, "generate_country_details"),
    ).not.toThrow();
    expect(() =>
      zodTextFormat(OpenAIRegionDetailsSchema, "generate_region_details"),
    ).not.toThrow();
  });

  test("does not emit unsupported uri formats for generated entity websites", () => {
    const jsonSchema = z.toJSONSchema(OpenAIEntityDetailsValidationSchema);

    expect(JSON.stringify(jsonSchema)).not.toContain('"format":"uri"');
  });
});
