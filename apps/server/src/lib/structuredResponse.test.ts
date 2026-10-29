import { zodSchema } from "ai";
import { expect, test } from "vitest";
import type { z } from "zod";
import { OpenAICountryDetailsSchema } from "../worker/jobs/generateCountryDetails";
import { OpenAIEntityDetailsSchema } from "../worker/jobs/generateEntityDetails";
import { OpenAIRegionDetailsSchema } from "../worker/jobs/generateRegionDetails";

const schemas: Array<[string, z.ZodType]> = [
  ["country", OpenAICountryDetailsSchema],
  ["entity", OpenAIEntityDetailsSchema],
  ["region", OpenAIRegionDetailsSchema],
];

test.each(schemas)(
  "the %s details schema requires every field",
  async (_name, schema) => {
    const jsonSchema = await zodSchema(schema).jsonSchema;

    expect(jsonSchema.required).toEqual(
      Object.keys(jsonSchema.properties ?? {}),
    );
  },
);
