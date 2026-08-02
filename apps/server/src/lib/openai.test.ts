import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { OpenAIBottleDetailsValidationSchema } from "../worker/jobs/generateBottleDetails";
import { OpenAICountryDetailsSchema } from "../worker/jobs/generateCountryDetails";
import { OpenAIEntityDetailsValidationSchema } from "../worker/jobs/generateEntityDetails";
import { OpenAIRegionDetailsSchema } from "../worker/jobs/generateRegionDetails";
import { buildStructuredResponseSpanContext } from "./openai";

test("uses GenAI workflow semantics for structured responses", () => {
  expect(
    buildStructuredResponseSpanContext(
      "generateBottleDetails",
      "gpt-5.6-terra",
    ),
  ).toEqual({
    op: "gen_ai.invoke_workflow",
    name: "invoke_workflow generateBottleDetails",
    attributes: {
      "gen_ai.operation.name": "invoke_workflow",
      "gen_ai.provider.name": "openai",
      "gen_ai.workflow.name": "generateBottleDetails",
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
      zodTextFormat(
        OpenAIBottleDetailsValidationSchema,
        "generate_bottle_details",
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
    const jsonSchema = z.toJSONSchema(
      OpenAIEntityDetailsValidationSchema,
    ) as unknown as {
      properties?: {
        website?: {
          anyOf?: Array<{ format?: string }>;
        };
      };
    };

    expect(
      jsonSchema.properties?.website?.anyOf?.some(
        (schema) => schema.format === "uri",
      ),
    ).toBe(false);
  });
});
