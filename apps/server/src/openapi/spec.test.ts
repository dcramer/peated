import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import router, { type Inputs, type Outputs } from "../orpc/router";
import {
  type BottleGroupV1,
  BottleSchema,
  CursorSchema,
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

function expectBottleResponse(schema: any) {
  const refs = [
    schema?.$ref,
    ...(schema?.allOf ?? []).map((part: any) => part?.$ref),
  ];
  expect(refs).toContain("#/components/schemas/Bottle");
  expect(JSON.stringify(schema)).not.toContain("targetId");
  expect(JSON.stringify(schema)).not.toContain('"kind"');
}

describe("OpenAPI generation ($ref reuse)", () => {
  it("documents human search input as plain text", async () => {
    const spec = await generateSpec();
    const searchPaths = [
      "/bottles",
      "/entities",
      "/bottle-series",
      "/search",
      "/users/{user}/collections/{collection}/bottles",
    ] as const;

    for (const path of searchPaths) {
      const queryParameter = (
        spec.paths?.[path]?.get?.parameters as any[]
      )?.find((parameter) => parameter.name === "query");

      expect(queryParameter?.schema?.description).toBe(
        "Plain-text search; operator syntax is not supported.",
      );
    }
  });

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
    expectBottleResponse(listResponse?.properties?.results?.items);
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

  it("exposes release-free Bottle mutation contracts", async () => {
    const spec = await generateSpec();

    expect(spec.paths?.["/bottles/from/{bottle}"]).toBeUndefined();
    expect(getOperationIds(spec)).not.toContain("createBottleFromSource");
    expect(spec.paths?.["/bottles/{bottle}/target"]).toBeUndefined();
    expect(getOperationIds(spec)).not.toContain("getBottleTarget");
    expect(spec.paths?.["/bottle-releases"]?.post).toBeUndefined();
    expect(getOperationIds(spec)).not.toContain("createBottleRelease");
    expect(spec.paths?.["/bottles/{bottle}/releases"]).toBeUndefined();
    expect(spec.paths?.["/bottle-releases/{release}"]).toBeUndefined();
    expect(spec.paths?.["/bottle-releases/{release}/bottle"]).toBeUndefined();
    expect(spec.components?.schemas?.BottleRelease).toBeUndefined();
    expect(getOperationIds(spec)).not.toContain("listBottleReleases");
    expect(getOperationIds(spec)).not.toContain("getBottleRelease");
    expect(getOperationIds(spec)).not.toContain("getBottleForRelease");
    expect(getOperationIds(spec)).not.toContain("updateBottleRelease");
    expect(getOperationIds(spec)).not.toContain("deleteBottleRelease");

    expect(spec.paths?.["/bottles"]?.post?.operationId).toBe("createBottle");
    expect(spec.paths?.["/bottles/{bottle}"]?.patch?.operationId).toBe(
      "updateBottle",
    );
    expect(
      spec.paths?.["/bottles/{bottle}/edit-context"]?.get?.operationId,
    ).toBe("getBottleEditContext");

    expectBottleResponse(getJsonResponseSchema(spec.paths?.["/bottles"]?.post));
    expectBottleResponse(
      getJsonResponseSchema(spec.paths?.["/bottles/{bottle}"]?.patch),
    );
    const bottleSchema = spec.components?.schemas?.Bottle as any;
    expect(bottleSchema?.properties?.group).toBeDefined();
    expect(bottleSchema?.properties?.targetId).toBeUndefined();
    expect(bottleSchema?.properties?.kind).toBeUndefined();

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

    expectTypeOf<Outputs["bottles"]["create"]>().toEqualTypeOf<
      z.infer<typeof BottleSchema>
    >();
    expectTypeOf<Outputs["bottles"]["update"]>().toEqualTypeOf<
      z.infer<typeof BottleSchema>
    >();
    expectTypeOf<
      "createFromSource" extends keyof Outputs["bottles"] ? true : false
    >().toEqualTypeOf<false>();
  });

  it("publishes audits as the only moderator review route contract", async () => {
    const spec = await generateSpec();
    const operations = [
      ["/audits", "get", "listAudits"],
      ["/audits", "post", "createAudit"],
      ["/audits/{audit}", "get", "getAudit"],
      ["/audits/{audit}/close", "post", "closeAudit"],
      ["/audits/{audit}/operations/approve", "post", "approveAuditOperations"],
      ["/audits/{audit}/operations/reject", "post", "rejectAuditOperations"],
      [
        "/audits/{audit}/operations/{operation}/retry",
        "post",
        "retryAuditOperation",
      ],
    ] as const;

    for (const [path, method, operationId] of operations) {
      expect((spec.paths?.[path] as any)?.[method]?.operationId).toBe(
        operationId,
      );
    }
    expect(
      Object.keys(spec.paths ?? {}).filter((path) =>
        path.startsWith("/bottle-checks"),
      ),
    ).toEqual([]);

    const detailsResponse = getJsonResponseSchema(
      spec.paths?.["/audits/{audit}"]?.get,
    );
    expect(detailsResponse?.required).toContain("audit");
    expect(detailsResponse?.properties).toHaveProperty("audit");
    expect(detailsResponse?.properties).not.toHaveProperty("check");

    expectTypeOf<
      "audit" extends keyof Inputs["audits"]["details"] ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      "check" extends keyof Inputs["audits"]["details"] ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "audit" extends keyof Outputs["audits"]["details"] ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<
      "check" extends keyof Outputs["audits"]["details"] ? true : false
    >().toEqualTypeOf<false>();
  });

  it("publishes Bottle aliases with one direct Bottle identity", async () => {
    const spec = await generateSpec();
    const listItem = getJsonResponseSchema(spec.paths?.["/bottle-aliases"]?.get)
      ?.properties?.results?.items;
    const upsertRequest = getJsonRequestSchema(
      spec.paths?.["/bottle-aliases"]?.put,
    );

    expect(Object.keys(listItem?.properties ?? {})).toEqual([
      "name",
      "createdAt",
      "bottleId",
      "isCanonical",
    ]);
    expect(listItem?.required).toEqual(["name", "createdAt", "bottleId"]);
    expect(JSON.stringify(listItem)).not.toContain("target");
    expect(Object.keys(upsertRequest?.properties ?? {})).toEqual([
      "bottle",
      "name",
    ]);
    expect(upsertRequest?.required).toEqual(["bottle", "name"]);
    expect(JSON.stringify(upsertRequest)).not.toContain("target");
  });

  it("publishes direct nullable Bottle identity for reviews and prices", async () => {
    const spec = await generateSpec();
    const reviewItem = getJsonResponseSchema(spec.paths?.["/reviews"]?.get)
      ?.properties?.results?.items;
    const storePrice = spec.components?.schemas?.StorePrice as any;
    const reviewParameters = spec.paths?.["/reviews"]?.get?.parameters ?? [];
    const reviewParameterNames = reviewParameters.map(
      (parameter: any) => parameter.name,
    );

    for (const schema of [reviewItem, storePrice]) {
      expect(schema?.properties?.bottle).toBeDefined();
      expect(JSON.stringify(schema?.properties?.bottle)).toContain(
        "#/components/schemas/Bottle",
      );
      expect(schema?.properties?.target).toBeUndefined();
      expect(JSON.stringify(schema)).not.toContain("CatalogTarget");
      expect(JSON.stringify(schema)).not.toContain("releaseId");
    }
    expect(reviewParameterNames).toContain("bottle");
    expect(reviewParameterNames).not.toContain("target");
    expect(reviewParameterNames).not.toContain("release");

    expectTypeOf<
      Outputs["reviews"]["list"]["results"][number]["bottle"]
    >().toEqualTypeOf<z.infer<typeof BottleSchema> | null>();
    expectTypeOf<
      Outputs["bottles"]["prices"]["list"]["results"][number]["bottle"]
    >().toEqualTypeOf<z.infer<typeof BottleSchema> | null>();
  });

  it("publishes member-anchored BottleGroup reads without management operations", async () => {
    const spec = await generateSpec();
    const operations = [
      ["/bottle-groups/{group}", "get", "getBottleGroup"],
      ["/bottle-groups/{group}/bottles", "get", "listBottleGroupBottles"],
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
    ).toHaveLength(2);
    expect(spec.paths?.["/bottle-groups"]).toBeUndefined();
    expect(
      spec.paths?.["/bottle-groups/{group}/merge-targets"],
    ).toBeUndefined();
    expect(spec.paths?.["/bottle-groups/{group}/split"]).toBeUndefined();

    const groupDetails = getJsonResponseSchema(
      spec.paths?.["/bottle-groups/{group}"]?.get,
    );
    const relatedBottleItem = getJsonResponseSchema(
      spec.paths?.["/bottle-groups/{group}/bottles"]?.get,
    )?.properties?.results?.items;

    expect(Object.keys(groupDetails?.properties ?? {})).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "representativeBottleId",
        "totalBottles",
      ]),
    );
    for (const bottleOwnedField of [
      "description",
      "descriptionSrc",
      "imageUrl",
      "tastingNotes",
      "suggestedTags",
    ]) {
      expect(groupDetails?.properties?.[bottleOwnedField]).toBeUndefined();
    }
    expect(JSON.stringify(groupDetails)).not.toContain("targetId");
    expect(JSON.stringify(groupDetails)).not.toContain('"kind"');
    expectBottleResponse(relatedBottleItem);

    expect(spec.paths?.["/bottle-groups/{group}/presentation"]).toBeUndefined();

    type CursorResult<T> = {
      results: T[];
      rel: { nextCursor: number | null; prevCursor: number | null };
    };
    expectTypeOf<
      Outputs["bottleGroups"]["details"]
    >().toEqualTypeOf<BottleGroupV1>();
    expectTypeOf<Outputs["bottleGroups"]["bottles"]>().toEqualTypeOf<
      CursorResult<z.infer<typeof BottleSchema>>
    >();
    expectTypeOf<
      "list" extends keyof Inputs["bottleGroups"] ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "merge" extends keyof Inputs["bottleGroups"] ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "split" extends keyof Inputs["bottleGroups"] ? true : false
    >().toEqualTypeOf<false>();
  });

  it("publishes direct-Bottle notification contracts", async () => {
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
        expect(Object.keys(refObject.properties)).toEqual(["id", "bottle"]);
        expect(refObject.required).toEqual(["id", "bottle"]);
        expect(refObject.properties.id).toMatchObject({
          type: "integer",
          exclusiveMinimum: 0,
        });
        expectBottleResponse(refObject.properties.bottle);
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
      NonNullable<ToastNotification["ref"]>["bottle"]
    >().toEqualTypeOf<z.infer<typeof BottleSchema>>();
    expectTypeOf<
      NonNullable<FriendRequestNotification["ref"]>
    >().toEqualTypeOf<{
      status: "pending" | "friends" | "none";
      userId: number;
    }>();
  });

  it("returns the created Bottle from photo creation", async () => {
    const spec = await generateSpec();
    const photoCreateOperation =
      spec.paths?.["/tastings/photo-identification-create"]?.post;
    const photoCreateSchema = getJsonResponseSchema(photoCreateOperation);
    expect(photoCreateOperation?.operationId).toBe(
      "createTastingBottleFromPhotoIdentification",
    );
    expect(photoCreateSchema?.required).toContain("bottle");
    expect(photoCreateSchema?.properties).not.toHaveProperty("release");
    expect(photoCreateSchema?.properties).not.toHaveProperty("target");
    expectTypeOf<
      Outputs["tastings"]["photoIdentificationCreate"]["bottle"]["id"]
    >().toEqualTypeOf<number>();
  });

  it("publishes direct Bottle mutation contracts", async () => {
    const spec = await generateSpec();
    const mergeOperation = spec.paths?.["/bottles/{bottle}/merge"]?.post;
    const mergeRequest = getJsonRequestSchema(mergeOperation);
    const tastingRequest = getJsonRequestSchema(
      spec.paths?.["/tastings"]?.post,
    );
    const flightRequest = getJsonRequestSchema(spec.paths?.["/flights"]?.post);
    const reviewRequest = getJsonRequestSchema(
      spec.paths?.["/reviews/{review}"]?.patch,
    );

    expect(spec.paths?.["/bottles/{bottle}/merge-targets"]).toBeUndefined();
    expect(mergeOperation?.operationId).toBe("mergeBottle");
    expect(mergeRequest?.properties).toHaveProperty("other");
    expect(mergeRequest?.properties).not.toHaveProperty("target");
    expect(mergeRequest?.properties).not.toHaveProperty("release");

    expect(tastingRequest?.required).toContain("bottle");
    expect(tastingRequest?.properties).not.toHaveProperty("target");
    expect(tastingRequest?.properties).not.toHaveProperty("release");

    expect(flightRequest?.properties?.bottles?.items).toMatchObject({
      type: "integer",
      exclusiveMinimum: 0,
    });
    expect(flightRequest?.properties).not.toHaveProperty("targets");
    expect(flightRequest?.properties).not.toHaveProperty("releases");

    expect(reviewRequest?.properties?.bottle).toMatchObject({
      anyOf: expect.arrayContaining([
        expect.objectContaining({
          type: "integer",
          exclusiveMinimum: 0,
        }),
        expect.objectContaining({ type: "null" }),
      ]),
    });
    expect(reviewRequest?.properties).not.toHaveProperty("target");
    expect(reviewRequest?.properties).not.toHaveProperty("release");

    expectTypeOf<
      Inputs["tastings"]["create"]["bottle"]
    >().toEqualTypeOf<number>();
    expectTypeOf<Inputs["flights"]["create"]["bottles"]>().toEqualTypeOf<
      number[] | undefined
    >();
    expectTypeOf<Inputs["reviews"]["update"]["bottle"]>().toEqualTypeOf<
      number | null | undefined
    >();
  });

  it("publishes direct Bottle collection contracts", async () => {
    const spec = await generateSpec();
    const createSchema = getJsonRequestSchema(
      spec.paths?.["/users/{user}/collections/{collection}/bottles"]?.post,
    );
    const deleteSchema = getJsonRequestSchema(
      spec.paths?.["/users/{user}/collections/{collection}/bottles"]?.delete,
    );
    const createResponseSchema = getJsonResponseSchema(
      spec.paths?.["/users/{user}/collections/{collection}/bottles"]?.post,
    );

    expect(createSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["bottle"]),
      additionalProperties: false,
      properties: {
        bottle: { type: "integer" },
        pendingImageId: { type: "string", minLength: 1 },
      },
    });
    expect(createSchema?.properties?.target).toBeUndefined();
    expect(createSchema?.properties?.release).toBeUndefined();

    expect(deleteSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["bottle"]),
      additionalProperties: false,
      properties: { bottle: { type: "integer" } },
    });
    expect(deleteSchema?.properties?.target).toBeUndefined();
    expect(deleteSchema?.properties?.release).toBeUndefined();
    expect(deleteSchema?.properties?.baseOnly).toBeUndefined();
    expect(createResponseSchema?.properties).toHaveProperty("bottle");
    expect(createResponseSchema?.properties).not.toHaveProperty("target");

    type CreateInput = Inputs["collections"]["bottles"]["create"];
    type DeleteInput = Inputs["collections"]["bottles"]["delete"];
    expectTypeOf<CreateInput["bottle"]>().toEqualTypeOf<number>();
    expectTypeOf<DeleteInput["bottle"]>().toEqualTypeOf<number>();
    expectTypeOf<
      "release" extends keyof CreateInput ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "target" extends keyof CreateInput ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "baseOnly" extends keyof DeleteInput ? true : false
    >().toEqualTypeOf<false>();
  });
});
