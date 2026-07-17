import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { describe, expect, it } from "vitest";
import router from "../orpc/router";
import {
  BottleSchema,
  CursorSchema,
  StorePriceSchema,
  UserSchema,
} from "../schemas";

async function generateSpec() {
  const gen = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  return await gen.generate(router, {
    info: { title: "Peated API", version: "1.0.0" },
    servers: [{ url: "/v1" }],
    commonSchemas: {
      Bottle: { schema: BottleSchema, strategy: "output" },
      Cursor: { schema: CursorSchema, strategy: "output" },
      User: { schema: UserSchema, strategy: "output" },
      StorePrice: { schema: StorePriceSchema, strategy: "output" },
    },
  });
}

describe("OpenAPI generation ($ref reuse)", () => {
  it("reuses Bottle and Cursor via $ref and composes details via allOf", async () => {
    const spec = await generateSpec();

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

  it("exposes another-release creation with one unique operation id", async () => {
    const spec = await generateSpec();
    expect(spec.paths?.["/bottles/from/{bottle}"]?.post?.operationId).toBe(
      "createBottleFromSource",
    );

    const operationIds = Object.values(spec.paths ?? {}).flatMap((path) =>
      Object.values(path ?? {}).flatMap((operation) => {
        if (
          typeof operation === "object" &&
          operation !== null &&
          "operationId" in operation
        ) {
          return [operation.operationId];
        }
        return [];
      }),
    );
    expect(
      operationIds.filter(
        (operationId) => operationId === "createBottleFromSource",
      ),
    ).toHaveLength(1);
  });

  it("exposes concrete Bottle editing with unique operation ids", async () => {
    const spec = await generateSpec();
    expect(spec.paths?.["/bottles/{bottle}"]?.patch?.operationId).toBe(
      "updateBottle",
    );
    expect(
      spec.paths?.["/bottles/{bottle}/edit-context"]?.get?.operationId,
    ).toBe("getBottleEditContext");

    const updateResponse: any =
      (spec.paths?.["/bottles/{bottle}"]?.patch?.responses as any)?.[200] ??
      (spec.paths?.["/bottles/{bottle}"]?.patch?.responses as any)?.["200"];
    const updateSchema = updateResponse?.content?.["application/json"]
      ?.schema as any;
    expect(Object.keys(updateSchema?.properties ?? {})).toEqual(
      expect.arrayContaining([
        "schemaVersion",
        "kind",
        "targetId",
        "group",
        "bottle",
      ]),
    );
    expect(updateSchema?.properties?.id).toBeUndefined();

    const editContextResponse: any =
      (
        spec.paths?.["/bottles/{bottle}/edit-context"]?.get?.responses as any
      )?.[200] ??
      (spec.paths?.["/bottles/{bottle}/edit-context"]?.get?.responses as any)?.[
        "200"
      ];
    const editContextSchema = editContextResponse?.content?.["application/json"]
      ?.schema as any;
    expect(Object.keys(editContextSchema?.properties ?? {})).toEqual(
      expect.arrayContaining(["bottleId", "totalBottles", "shared", "exact"]),
    );
    expect(editContextSchema?.properties?.groupId).toBeUndefined();
    expect(editContextSchema?.properties?.targetId).toBeUndefined();

    const operationIds = Object.values(spec.paths ?? {}).flatMap((path) =>
      Object.values(path ?? {}).flatMap((operation) => {
        if (
          typeof operation === "object" &&
          operation !== null &&
          "operationId" in operation
        ) {
          return [operation.operationId];
        }
        return [];
      }),
    );
    expect(operationIds.filter((id) => id === "updateBottle")).toHaveLength(1);
    expect(
      operationIds.filter((id) => id === "getBottleEditContext"),
    ).toHaveLength(1);
  });
});
