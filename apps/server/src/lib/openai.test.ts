import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { OpenAIBottleDetailsValidationSchema } from "../worker/jobs/generateBottleDetails";
import { OpenAICountryDetailsSchema } from "../worker/jobs/generateCountryDetails";
import { OpenAIEntityDetailsValidationSchema } from "../worker/jobs/generateEntityDetails";
import { OpenAIRegionDetailsSchema } from "../worker/jobs/generateRegionDetails";
import { MAX_BOTTLE_SUGGESTED_TAGS } from "./bottleSchemas";
import { buildStructuredResponseSpanContext } from "./openai";

const EntityJsonSchemaContract = z.object({
  properties: z
    .object({
      website: z
        .object({
          anyOf: z
            .array(z.object({ format: z.string().optional() }))
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const BottleJsonSchemaContract = z.object({
  properties: z
    .object({
      suggestedTags: z.object({ maxItems: z.number().optional() }).optional(),
    })
    .optional(),
});

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
    const jsonSchema = EntityJsonSchemaContract.parse(
      z.toJSONSchema(OpenAIEntityDetailsValidationSchema),
    );

    expect(
      jsonSchema.properties?.website?.anyOf?.some(
        (schema) => schema.format === "uri",
      ),
    ).toBe(false);
  });

  test("limits generated bottle tags to the storage contract", () => {
    const jsonSchema = BottleJsonSchemaContract.parse(
      z.toJSONSchema(OpenAIBottleDetailsValidationSchema),
    );

    expect(jsonSchema.properties?.suggestedTags?.maxItems).toBe(
      MAX_BOTTLE_SUGGESTED_TAGS,
    );
  });
});
