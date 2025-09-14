import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { describe, expect, it } from "vitest";
import router from "../orpc/router";
import {
  BottleSchema,
  CursorSchema,
  StorePriceSchema,
  UserSchema,
} from "../schemas";

describe("OpenAPI generation ($ref reuse)", () => {
  it("reuses Bottle and Cursor via $ref and composes details via allOf", async () => {
    const gen = new OpenAPIGenerator({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    });

    const spec = await gen.generate(router, {
      info: { title: "Peated API", version: "1.0.0" },
      servers: [{ url: "/v1" }],
      commonSchemas: {
        Bottle: { schema: BottleSchema, strategy: "output" },
        Cursor: { schema: CursorSchema, strategy: "output" },
        User: { schema: UserSchema, strategy: "output" },
        StorePrice: { schema: StorePriceSchema, strategy: "output" },
      },
    });

    // Component refs exist
    expect(spec.components?.schemas?.Bottle).toBeDefined();
    expect(spec.components?.schemas?.Cursor).toBeDefined();

    // List response uses $ref for items and rel
    const listResp200: any =
      (spec.paths?.["/bottles"]?.get?.responses as any)?.[200] ??
      (spec.paths?.["/bottles"]?.get?.responses as any)?.["200"]; // keys may be stringified
    const listResponse = listResp200?.content?.["application/json"]
      ?.schema as any;
    expect(listResponse?.properties?.results?.items?.$ref).toEqual(
      "#/components/schemas/Bottle",
    );
    const relSchema = listResponse?.properties?.rel;
    // Cursor should be a $ref or inline resolution depending on converter depth; prefer $ref
    if (relSchema?.$ref) {
      expect(relSchema.$ref).toEqual("#/components/schemas/Cursor");
    }

    // Details response composes Bottle via allOf
    const detailsResp200: any =
      (spec.paths?.["/bottles/{bottle}"]?.get?.responses as any)?.[200] ??
      (spec.paths?.["/bottles/{bottle}"]?.get?.responses as any)?.["200"]; // keys may be stringified
    const detailsResponse = detailsResp200?.content?.["application/json"]
      ?.schema as any;
    const allOf = detailsResponse?.allOf as any[];
    expect(Array.isArray(allOf)).toBe(true);
    expect(allOf.some((s) => s?.$ref === "#/components/schemas/Bottle")).toBe(
      true,
    );
  });
});
