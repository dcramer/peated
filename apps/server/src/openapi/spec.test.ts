import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import router, { type Inputs, type Outputs } from "../orpc/router";
import {
  type BottleGroupAliasV1,
  BottleSchema,
  type CatalogTargetV1,
  CursorSchema,
  type ExactCatalogTargetV1,
  type GenericCatalogTargetV1,
  type NotificationSchema,
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

function getJsonResponseSchema(operation: any) {
  const response = operation?.responses?.[200] ?? operation?.responses?.["200"];
  return response?.content?.["application/json"]?.schema as any;
}

function getJsonRequestSchema(operation: any) {
  return operation?.requestBody?.content?.["application/json"]?.schema as any;
}

function getOperationIds(spec: Awaited<ReturnType<typeof generateSpec>>) {
  return Object.values(spec.paths ?? {}).flatMap((path) =>
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
}

function expectExactTargetResponse(schema: any) {
  expect(Object.keys(schema?.properties ?? {})).toEqual(
    expect.arrayContaining([
      "schemaVersion",
      "kind",
      "targetId",
      "group",
      "bottle",
    ]),
  );
  expect(schema?.properties?.release).toBeUndefined();
  expect(schema?.properties?.releaseId).toBeUndefined();
  expect(JSON.stringify(schema)).not.toContain("BottleRelease");
}

function expectGenericTargetResponse(schema: any) {
  expect(Object.keys(schema?.properties ?? {})).toEqual(
    expect.arrayContaining(["schemaVersion", "kind", "targetId", "group"]),
  );
  expect(schema?.properties?.bottle).toBeUndefined();
  expect(schema?.properties?.release).toBeUndefined();
  expect(schema?.properties?.releaseId).toBeUndefined();
  expect(JSON.stringify(schema)).not.toContain("BottleRelease");
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

  it("exposes release-free concrete Bottle mutation contracts", async () => {
    const spec = await generateSpec();

    expect(spec.paths?.["/bottles/from/{bottle}"]).toBeUndefined();
    expect(getOperationIds(spec)).not.toContain("createBottleFromSource");

    expect(spec.paths?.["/bottles"]?.post?.operationId).toBe("createBottle");
    expect(spec.paths?.["/bottles/{bottle}"]?.patch?.operationId).toBe(
      "updateBottle",
    );
    expect(
      spec.paths?.["/bottles/{bottle}/edit-context"]?.get?.operationId,
    ).toBe("getBottleEditContext");

    expectExactTargetResponse(
      getJsonResponseSchema(spec.paths?.["/bottles"]?.post),
    );
    expectExactTargetResponse(
      getJsonResponseSchema(spec.paths?.["/bottles/{bottle}"]?.patch),
    );

    const editContextSchema = getJsonResponseSchema(
      spec.paths?.["/bottles/{bottle}/edit-context"]?.get,
    );
    expect(Object.keys(editContextSchema?.properties ?? {})).toEqual(
      expect.arrayContaining(["bottleId", "totalBottles", "shared", "exact"]),
    );
    expect(editContextSchema?.properties?.groupId).toBeUndefined();
    expect(editContextSchema?.properties?.targetId).toBeUndefined();

    const operationIds = getOperationIds(spec);
    expect(operationIds.filter((id) => id === "createBottle")).toHaveLength(1);
    expect(operationIds.filter((id) => id === "updateBottle")).toHaveLength(1);
    expect(
      operationIds.filter((id) => id === "getBottleEditContext"),
    ).toHaveLength(1);

    expectTypeOf<
      Outputs["bottles"]["create"]
    >().toEqualTypeOf<ExactCatalogTargetV1>();
    expectTypeOf<
      Outputs["bottles"]["update"]
    >().toEqualTypeOf<ExactCatalogTargetV1>();
    expectTypeOf<
      "createFromSource" extends keyof Outputs["bottles"] ? true : false
    >().toEqualTypeOf<false>();
  });

  it("publishes the legacy BottleRelease redirect target", async () => {
    const spec = await generateSpec();
    const operation = spec.paths?.["/bottle-releases/{release}/target"]?.get;

    expect(operation?.operationId).toBe("getBottleReleaseTarget");
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "release",
          in: "path",
          required: true,
        }),
        expect.objectContaining({
          name: "bottle",
          in: "query",
          required: true,
        }),
      ]),
    );
    const responseSchema = getJsonResponseSchema(operation);
    expect(responseSchema?.type).toBe("object");
    expect(responseSchema?.required).toEqual(["bottleId"]);
    expect(Object.keys(responseSchema?.properties ?? {})).toEqual(["bottleId"]);
    expect(responseSchema?.properties?.bottleId).toMatchObject({
      type: "integer",
      exclusiveMinimum: 0,
    });
    expect(responseSchema?.oneOf).toBeUndefined();
    expect(responseSchema?.anyOf).toBeUndefined();

    expectTypeOf<Outputs["bottleReleases"]["target"]>().toEqualTypeOf<{
      bottleId: number;
    }>();
  });

  it("publishes BottleGroup reads and bounded moderator operations", async () => {
    const spec = await generateSpec();
    const operations = [
      ["/bottle-groups", "get", "listBottleGroups"],
      ["/bottle-groups/{group}", "get", "getBottleGroup"],
      ["/bottle-groups/{group}/bottles", "get", "listBottleGroupBottles"],
      ["/bottle-groups/{group}/aliases", "get", "listBottleGroupAliases"],
      ["/bottle-groups/{group}/merge-targets", "post", "mergeBottleGroup"],
      ["/bottle-groups/{group}/split", "post", "splitBottleGroup"],
      [
        "/bottle-groups/{group}/presentation",
        "patch",
        "updateBottleGroupPresentation",
      ],
    ] as const;
    const operationIds = getOperationIds(spec);

    for (const [path, method, operationId] of operations) {
      expect((spec.paths?.[path] as any)?.[method]?.operationId).toBe(
        operationId,
      );
      expect(operationIds.filter((id) => id === operationId)).toHaveLength(1);
    }
    expect(
      Object.entries(spec.paths ?? {}).flatMap(([path, pathItem]) =>
        path.startsWith("/bottle-groups")
          ? Object.values(pathItem ?? {}).filter(
              (operation) =>
                typeof operation === "object" &&
                operation !== null &&
                "operationId" in operation,
            )
          : [],
      ),
    ).toHaveLength(7);

    const groupListItem = getJsonResponseSchema(
      spec.paths?.["/bottle-groups"]?.get,
    )?.properties?.results?.items;
    const groupDetails = getJsonResponseSchema(
      spec.paths?.["/bottle-groups/{group}"]?.get,
    );
    const relatedBottleItem = getJsonResponseSchema(
      spec.paths?.["/bottle-groups/{group}/bottles"]?.get,
    )?.properties?.results?.items;
    const aliasItem = getJsonResponseSchema(
      spec.paths?.["/bottle-groups/{group}/aliases"]?.get,
    )?.properties?.results?.items;

    expectGenericTargetResponse(groupListItem);
    expectGenericTargetResponse(groupDetails);
    expectExactTargetResponse(relatedBottleItem);
    expect(Object.keys(aliasItem?.properties ?? {})).toEqual([
      "name",
      "assignmentSource",
      "createdAt",
    ]);
    expect(aliasItem?.properties?.targetId).toBeUndefined();
    expect(aliasItem?.properties?.bottle).toBeUndefined();
    expect(aliasItem?.properties?.release).toBeUndefined();
    expect(aliasItem?.properties?.releaseId).toBeUndefined();
    expect(JSON.stringify(aliasItem)).not.toContain("BottleRelease");

    const mergeRequest = getJsonRequestSchema(
      spec.paths?.["/bottle-groups/{group}/merge-targets"]?.post,
    );
    const splitRequest = getJsonRequestSchema(
      spec.paths?.["/bottle-groups/{group}/split"]?.post,
    );
    const presentationRequest = getJsonRequestSchema(
      spec.paths?.["/bottle-groups/{group}/presentation"]?.patch,
    );
    expect(Object.keys(mergeRequest?.properties ?? {})).toEqual([
      "destinationGroupId",
    ]);
    expect(Object.keys(splitRequest?.properties ?? {})).toEqual([
      "movedBottleIds",
      "newRepresentativeBottleId",
      "sourceRepresentativeBottleId",
    ]);
    expect(Object.keys(presentationRequest?.properties ?? {})).toEqual([
      "representativeBottleId",
      "description",
      "descriptionSrc",
      "imageUrl",
      "tastingNotes",
    ]);
    for (const sharedIdentityField of [
      "name",
      "fullName",
      "brandId",
      "bottlerId",
      "distillerIds",
      "category",
      "seriesId",
      "statedAge",
      "flavorProfile",
      "groupId",
      "targetId",
    ]) {
      expect(
        presentationRequest?.properties?.[sharedIdentityField],
      ).toBeUndefined();
    }

    type CursorResult<T> = {
      results: T[];
      rel: { nextCursor: number | null; prevCursor: number | null };
    };
    expectTypeOf<Outputs["bottleGroups"]["list"]>().toEqualTypeOf<
      CursorResult<GenericCatalogTargetV1>
    >();
    expectTypeOf<
      Outputs["bottleGroups"]["details"]
    >().toEqualTypeOf<GenericCatalogTargetV1>();
    expectTypeOf<Outputs["bottleGroups"]["bottles"]>().toEqualTypeOf<
      CursorResult<ExactCatalogTargetV1>
    >();
    expectTypeOf<Outputs["bottleGroups"]["aliases"]>().toEqualTypeOf<
      CursorResult<BottleGroupAliasV1>
    >();
    expectTypeOf<
      "name" extends keyof Inputs["bottleGroups"]["updatePresentation"]
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "groupId" extends keyof Inputs["bottleGroups"]["merge"] ? true : false
    >().toEqualTypeOf<false>();
  });

  it("publishes discriminated target-backed notification contracts", async () => {
    const spec = await generateSpec();
    const listItemSchema = getJsonResponseSchema(
      spec.paths?.["/notifications"]?.get,
    )?.properties?.results?.items;
    const updateSchema = getJsonResponseSchema(
      spec.paths?.["/notifications/{notification}"]?.patch,
    );

    for (const schema of [listItemSchema, updateSchema]) {
      expect(schema?.anyOf).toHaveLength(3);
      const variants = Object.fromEntries(
        schema.anyOf.map((variant: any) => [
          variant.properties?.type?.const,
          variant,
        ]),
      );
      expect(Object.keys(variants).sort()).toEqual([
        "comment",
        "friend_request",
        "toast",
      ]);

      const friendRef = variants.friend_request.properties.ref;
      expect(friendRef.anyOf).toHaveLength(2);
      expect(friendRef.anyOf).toContainEqual({ type: "null" });
      const friendRefObject = friendRef.anyOf.find(
        (candidate: any) => candidate.type === "object",
      );
      expect(Object.keys(friendRefObject.properties)).toEqual([
        "status",
        "userId",
      ]);
      expect(friendRefObject.required).toEqual(["status", "userId"]);
      expect(friendRefObject.properties.userId).toMatchObject({
        type: "integer",
        exclusiveMinimum: 0,
      });

      for (const type of ["toast", "comment"] as const) {
        const ref = variants[type].properties.ref;
        expect(ref.anyOf).toHaveLength(2);
        expect(ref.anyOf).toContainEqual({ type: "null" });
        const refObject = ref.anyOf.find(
          (candidate: any) => candidate.type === "object",
        );
        expect(Object.keys(refObject.properties)).toEqual(["id", "target"]);
        expect(refObject.required).toEqual(["id", "target"]);
        expect(refObject.properties.id).toMatchObject({
          type: "integer",
          exclusiveMinimum: 0,
        });
        const [genericTarget, exactTarget] = refObject.properties.target.anyOf;
        expectGenericTargetResponse(genericTarget);
        expectExactTargetResponse(exactTarget);
      }
    }

    type NotificationContract = z.infer<typeof NotificationSchema>;
    type NotificationList = {
      results: NotificationContract[];
      rel: { nextCursor: number | null; prevCursor: number | null };
    };
    expectTypeOf<
      Outputs["notifications"]["list"]
    >().toEqualTypeOf<NotificationList>();
    expectTypeOf<
      Outputs["notifications"]["update"]
    >().toEqualTypeOf<NotificationContract>();
    type ToastNotification = Extract<
      Outputs["notifications"]["update"],
      { type: "toast" }
    >;
    type FriendRequestNotification = Extract<
      Outputs["notifications"]["update"],
      { type: "friend_request" }
    >;
    expectTypeOf<
      NonNullable<ToastNotification["ref"]>["target"]
    >().toEqualTypeOf<CatalogTargetV1>();
    expectTypeOf<
      NonNullable<FriendRequestNotification["ref"]>
    >().toEqualTypeOf<{
      status: "pending" | "friends" | "none";
      userId: number;
    }>();
  });

  it("keeps photo creation release compatibility null-only", async () => {
    const spec = await generateSpec();
    const photoCreateSchema = getJsonResponseSchema(
      spec.paths?.["/tastings/photo-identification-create"]?.post,
    );
    const releaseSchema = photoCreateSchema?.properties?.release;

    expect(releaseSchema?.type).toBe("null");
    expect(releaseSchema?.anyOf).toBeUndefined();
    expect(releaseSchema?.oneOf).toBeUndefined();
    expect(JSON.stringify(releaseSchema)).not.toContain("BottleRelease");
    expectTypeOf<
      Outputs["tastings"]["photoIdentificationCreate"]["release"]
    >().toEqualTypeOf<null>();
  });

  it("publishes explicit target-native and retained collection input variants", async () => {
    const spec = await generateSpec();
    const createSchema = getJsonRequestSchema(
      spec.paths?.["/users/{user}/collections/{collection}/bottles"]?.post,
    );
    const deleteSchema = getJsonRequestSchema(
      spec.paths?.["/users/{user}/collections/{collection}/bottles"]?.delete,
    );
    const createAlternatives = createSchema?.oneOf;
    const deleteAlternatives = deleteSchema?.oneOf;

    expect(createAlternatives).toHaveLength(2);
    expect(deleteAlternatives).toHaveLength(2);

    const targetCreate = createAlternatives?.find(
      (schema: any) => schema.properties?.target,
    );
    const legacyCreate = createAlternatives?.find(
      (schema: any) => schema.properties?.bottle,
    );
    expect(targetCreate).toMatchObject({
      type: "object",
      required: ["target"],
      additionalProperties: false,
      properties: {
        target: { type: "integer", exclusiveMinimum: 0 },
        pendingImageId: { type: "string", minLength: 1 },
      },
    });
    expect(targetCreate?.properties?.bottle).toBeUndefined();
    expect(targetCreate?.properties?.release).toBeUndefined();
    expect(legacyCreate).toMatchObject({
      type: "object",
      required: ["bottle"],
      additionalProperties: false,
      properties: {
        bottle: { type: "number" },
        pendingImageId: { type: "string", minLength: 1 },
      },
    });
    expect(legacyCreate?.properties?.target).toBeUndefined();
    expect(JSON.stringify(legacyCreate?.properties?.release)).toContain(
      "number",
    );

    const targetDelete = deleteAlternatives?.find(
      (schema: any) => schema.properties?.target,
    );
    const legacyDelete = deleteAlternatives?.find(
      (schema: any) => schema.properties?.bottle,
    );
    expect(targetDelete).toMatchObject({
      type: "object",
      required: ["target"],
      additionalProperties: false,
    });
    expect(targetDelete?.properties?.baseOnly).toBeUndefined();
    expect(targetDelete?.properties?.bottle).toBeUndefined();
    expect(targetDelete?.properties?.release).toBeUndefined();
    expect(legacyDelete).toMatchObject({
      type: "object",
      required: ["bottle"],
      additionalProperties: false,
      properties: { bottle: { type: "number" } },
    });
    expect(legacyDelete?.properties?.target).toBeUndefined();
    expect(legacyDelete?.properties?.baseOnly).toBeDefined();

    type TargetCreateInput = Extract<
      Inputs["collections"]["bottles"]["create"],
      { target: number }
    >;
    type LegacyCreateInput = Extract<
      Inputs["collections"]["bottles"]["create"],
      { bottle: number }
    >;
    type TargetDeleteInput = Extract<
      Inputs["collections"]["bottles"]["delete"],
      { target: number }
    >;
    type LegacyDeleteInput = Extract<
      Inputs["collections"]["bottles"]["delete"],
      { bottle: number }
    >;
    expectTypeOf<TargetCreateInput["target"]>().toEqualTypeOf<number>();
    expectTypeOf<LegacyCreateInput["bottle"]>().toEqualTypeOf<number>();
    expectTypeOf<LegacyCreateInput["release"]>().toEqualTypeOf<
      number | null | undefined
    >();
    expectTypeOf<LegacyDeleteInput["baseOnly"]>().toEqualTypeOf<unknown>();
    expectTypeOf<
      "release" extends keyof TargetCreateInput ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "target" extends keyof LegacyCreateInput ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "baseOnly" extends keyof TargetDeleteInput ? true : false
    >().toEqualTypeOf<false>();
  });
});
