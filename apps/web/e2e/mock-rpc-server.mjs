import http from "node:http";

import {
  addAnotherReleaseSourceBottle,
  anotherReleaseSourceBottle,
  bottleGroupId,
  bottleGroupMemberTargets,
  bottleGroupRepresentative,
  bottleGroupTarget,
  bottleImageBottleId,
  bottleImageUrl,
  buildActivity,
  buildBottle,
  buildCollectionBottle,
  buildExactCatalogTarget,
  buildFavoriteActivity,
  buildGenericCatalogTarget,
  buildTasting,
  conflictingPageTargetBottleId,
  createdBottleId,
  createdBottleName,
  createdFlightTargetFixtureId,
  createdTastingId,
  destinationBottleGroupId,
  destinationBottleGroupTarget,
  emptyLibraryStats,
  emptyList,
  exactReplacementSourceBottleId,
  exactSearchBottle,
  existingBottle,
  existingBottleId,
  existingRelease,
  existingReleaseId,
  failingTastingNotes,
  flightTargetFixture,
  flightTargetFixtureId,
  genericTastingNotes,
  groupedBottleDetails,
  legacyIncompleteReleaseId,
  legacyPromotedBottle,
  legacyPromotedBottleId,
  missingPageTargetBottleId,
  photoTastingNotes,
  priceChangeList,
  priceSite,
  retiredParentBottleId,
  splitBottleGroupId,
  splitBottleGroupTarget,
  storePriceList,
  suggestedTags,
  tastingNotes,
  testBrand,
  testUser,
  unifiedBottleEditContext,
} from "./rpc-fixtures.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_API_PORT ?? 4999);

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, baggage, content-type, sentry-trace",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "x-sentry-trace-id",
  Vary: "Origin",
};

const mockUploadImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const collectionStateByToken = new Map();
const pendingUploadStateByToken = new Map();
const appliedQueueProposalTokens = new Set();
let collectionBottleId = 1;
let pendingUploadId = 1;

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders).end();
    return;
  }

  if (request.url === "/health") {
    response.writeHead(204, corsHeaders).end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname.startsWith("/uploads/")) {
    response
      .writeHead(200, {
        ...corsHeaders,
        "Cache-Control": "no-store",
        "Content-Type": "image/png",
      })
      .end(mockUploadImage);
    return;
  }

  if (url.pathname.startsWith("/rpc")) {
    const handled = await handleRpcRequest({ request, response, url });
    if (!handled) {
      request.resume();
    }
    return;
  }

  response.writeHead(404, corsHeaders).end();
});

server.listen(port, host, () => {
  console.log(`Mock RPC server listening on http://${host}:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

async function handleRpcRequest({ request, response, url }) {
  const path = url.pathname.replace(/^\/rpc\/?/, "");
  const input = await readRpcInput(request, url);

  switch (path) {
    case "activity/list":
      sendRpcResponse(
        response,
        input?.cursor
          ? buildActivity()
          : buildFavoriteActivity({ nextCursor: 1 }),
      );
      return true;
    case "users/activity/list":
      sendRpcResponse(
        response,
        input?.cursor
          ? buildActivity()
          : buildFavoriteActivity({ nextCursor: 1 }),
      );
      return true;
    case "entities/list":
      if (input?.query === testBrand.name) {
        sendRpcResponse(response, {
          ...emptyList,
          results: [testBrand],
        });
        return true;
      }
      return false;
    case "entities/details":
      if (Number(input?.entity) === testBrand.id) {
        sendRpcResponse(response, testBrand);
        return true;
      }
      sendRpcError(response, "Unexpected entity details payload");
      return true;
    case "bottles/editContext":
      if (input?.bottle !== unifiedBottleEditContext.bottleId) {
        sendRpcError(response, "Unexpected Bottle edit context payload");
        return true;
      }
      sendRpcResponse(response, unifiedBottleEditContext);
      return true;
    case "bottles/update":
      if (input?.bottle !== unifiedBottleEditContext.bottleId) {
        sendRpcError(response, "Unexpected Bottle update payload");
        return true;
      }
      sendRpcResponse(response, buildExactCatalogTarget());
      return true;
    case "search": {
      const bottleGroupWorkflow = getAccessToken(request).includes(
        "bottle-group-workflows",
      );
      const expectedIncludes = bottleGroupWorkflow
        ? ["bottles", "users", "entities"]
        : ["bottles"];
      if (
        !Array.isArray(input?.include) ||
        input.include.length !== expectedIncludes.length ||
        !expectedIncludes.every(
          (include, index) => input.include[index] === include,
        )
      ) {
        sendRpcError(response, "Expected bottle search");
        return true;
      }

      sendRpcResponse(response, {
        query: input.query ?? "",
        results: [
          {
            type: "bottle",
            ref: withCollectionStatus(
              request,
              bottleGroupWorkflow
                ? groupedBottleDetails
                : getAccessToken(request).includes("search-route")
                  ? exactSearchBottle
                  : existingBottle,
            ),
          },
        ],
      });
      return true;
    }
    case "bottles/create": {
      if (getAccessToken(request).includes("ordinary-exact-create")) {
        if (!isExpectedOrdinaryExactBottleCreateInput(input)) {
          sendRpcError(response, "Unexpected exact Bottle create payload");
          return true;
        }

        const bottle = {
          ...buildBottle({
            id: createdBottleId,
            name: createdBottleName,
            brand: testBrand,
          }),
          edition: "Founder's Cask",
          abv: 58.7,
          releaseYear: 2025,
          vintageYear: 2009,
          singleCask: true,
          caskStrength: true,
          caskFill: "1st_fill",
          caskType: "oloroso",
          caskSize: "hogshead",
        };
        sendRpcResponse(response, buildExactCatalogTarget({ bottle }));
        return true;
      }

      if (getAccessToken(request).includes("add-another-release")) {
        if (
          input?.name !== addAnotherReleaseSourceBottle.group.name ||
          input?.brand !== addAnotherReleaseSourceBottle.brand.id ||
          input?.statedAge !== addAnotherReleaseSourceBottle.statedAge ||
          input?.edition !== addAnotherReleaseSourceBottle.edition ||
          input?.abv !== addAnotherReleaseSourceBottle.abv ||
          input?.releaseYear !== addAnotherReleaseSourceBottle.releaseYear
        ) {
          sendRpcError(response, "Unexpected add another release payload");
          return true;
        }

        const bottle = {
          ...addAnotherReleaseSourceBottle,
          id: createdBottleId,
        };
        sendRpcResponse(response, buildExactCatalogTarget({ bottle }));
        return true;
      }

      const expectedBrand =
        input?.brand === testBrand.id ||
        (input?.brand &&
          typeof input.brand === "object" &&
          input.brand.name === testBrand.name);
      if (input?.name !== createdBottleName || !expectedBrand) {
        sendRpcError(response, "Unexpected bottle create payload");
        return true;
      }

      const bottle = buildBottle({
        id: createdBottleId,
        name: createdBottleName,
        brand: testBrand,
      });
      sendRpcResponse(response, buildExactCatalogTarget({ bottle }));
      return true;
    }
    case "prices/matchQueue/list": {
      const token = getAccessToken(request);
      if (!token.includes("queue-release-only")) {
        return false;
      }

      const applied = appliedQueueProposalTokens.has(token);
      sendRpcResponse(response, {
        results: applied ? [] : [buildReleaseOnlyQueueProposal()],
        rel: { nextCursor: null, prevCursor: null },
        stats: {
          actionableCount: applied ? 0 : 1,
          processingCount: 0,
        },
      });
      return true;
    }
    case "prices/matchQueue/activeRetryRun":
      if (!getAccessToken(request).includes("queue-release-only")) {
        return false;
      }
      sendRpcResponse(response, { run: null });
      return true;
    case "prices/matchQueue/details":
      if (input?.proposal !== 9901) {
        sendRpcError(
          response,
          "Unexpected price match proposal details payload",
        );
        return true;
      }

      sendRpcResponse(response, buildBottleAndReleaseProposal());
      return true;
    case "prices/matchQueue/createBottle": {
      const token = getAccessToken(request);
      if (token.includes("queue-release-only")) {
        if (!isExpectedReleaseOnlyQueueCreateInput(input)) {
          sendRpcError(
            response,
            "Unexpected release-only queue create Bottle payload",
          );
          return true;
        }

        appliedQueueProposalTokens.add(token);
        const bottle = buildReleaseOnlyQueueBottle();
        sendRpcResponse(response, {
          targetId: buildExactCatalogTarget({ bottle }).targetId,
          bottle,
          release: null,
        });
        return true;
      }

      const expectedBrand =
        input?.independentBottle?.brand === testBrand.id ||
        (input?.independentBottle?.brand &&
          typeof input.independentBottle.brand === "object" &&
          input.independentBottle.brand.name === testBrand.name);
      if (
        input?.proposal !== 9901 ||
        input?.independentBottle?.name !== createdBottleName ||
        !expectedBrand ||
        input?.independentBottle?.edition !== "First Fill Oloroso" ||
        input?.bottle !== undefined ||
        input?.release !== undefined
      ) {
        sendRpcError(response, "Unexpected price match create bottle payload");
        return true;
      }

      const bottle = buildBottleForId(createdBottleId);
      sendRpcResponse(response, {
        targetId: buildExactCatalogTarget({ bottle }).targetId,
        bottle,
        release: null,
      });
      return true;
    }
    case "prices/changeList":
      sendRpcResponse(response, priceChangeList);
      return true;
    case "prices/list":
      if (input?.site !== priceSite.type) {
        sendRpcError(response, "Unexpected price list payload");
        return true;
      }
      sendRpcResponse(response, storePriceList);
      return true;
    case "externalSites/details":
      if (input?.site !== priceSite.type) {
        sendRpcError(response, "Unexpected external site details payload");
        return true;
      }
      sendRpcResponse(response, priceSite);
      return true;
    case "bottleGroups/details": {
      const target = getBottleGroupTarget(input?.group);
      if (!target) {
        sendRpcError(response, "Unexpected BottleGroup details payload");
        return true;
      }
      sendRpcResponse(response, target);
      return true;
    }
    case "bottleGroups/bottles":
      if (input?.group === bottleGroupId) {
        sendRpcResponse(response, {
          results: bottleGroupMemberTargets,
          rel: { nextCursor: null, prevCursor: null },
        });
        return true;
      }
      if (
        input?.group === destinationBottleGroupId ||
        input?.group === splitBottleGroupId
      ) {
        sendRpcResponse(response, emptyList);
        return true;
      }
      sendRpcError(response, "Unexpected BottleGroup member list payload");
      return true;
    case "bottleGroups/list":
      sendRpcResponse(response, {
        results: [bottleGroupTarget, destinationBottleGroupTarget],
        rel: { nextCursor: null, prevCursor: null },
      });
      return true;
    case "flights/details":
      if (
        input?.flight !== flightTargetFixtureId &&
        input?.flight !== createdFlightTargetFixtureId
      ) {
        sendRpcError(response, "Unexpected Flight details payload");
        return true;
      }
      sendRpcResponse(response, {
        ...flightTargetFixture,
        id: input.flight,
      });
      return true;
    case "flights/create": {
      const expectedTargetIds = [
        buildExactCatalogTarget().targetId,
        bottleGroupTarget.targetId,
      ];
      if (
        input?.name !== "Target-aware Flight" ||
        input?.bottles !== undefined ||
        !Array.isArray(input?.targets) ||
        input.targets.length !== expectedTargetIds.length ||
        !expectedTargetIds.every((targetId) => input.targets.includes(targetId))
      ) {
        sendRpcError(response, "Unexpected target-native Flight payload");
        return true;
      }
      sendRpcResponse(response, {
        id: createdFlightTargetFixtureId,
        name: input.name,
        description: input.description ?? null,
        public: input.public ?? false,
        createdAt: flightTargetFixture.createdAt,
        createdBy: testUser,
      });
      return true;
    }
    case "bottleGroups/merge":
      if (
        input?.group !== bottleGroupId ||
        input?.destinationGroupId !== destinationBottleGroupId ||
        Object.keys(input).length !== 2
      ) {
        sendRpcError(response, "Unexpected BottleGroup merge payload");
        return true;
      }
      sendRpcResponse(response, {
        sourceGroupId: bottleGroupId,
        destinationGroupId: destinationBottleGroupId,
        changed: true,
        movedBottleIds: bottleGroupMemberTargets.map(({ bottle }) => bottle.id),
      });
      return true;
    case "bottleGroups/split":
      if (!isExpectedBottleGroupSplitInput(input)) {
        sendRpcError(response, "Unexpected BottleGroup split payload");
        return true;
      }
      sendRpcResponse(response, {
        sourceGroupId: bottleGroupId,
        newGroupId: splitBottleGroupId,
        movedBottleIds: [bottleGroupRepresentative.id],
        sourceRepresentativeBottleId: bottleGroupMemberTargets[1].bottle.id,
        newRepresentativeBottleId: bottleGroupRepresentative.id,
      });
      return true;
    case "bottles/pageTarget": {
      if (input?.bottle === exactReplacementSourceBottleId) {
        sendRpcResponse(response, {
          kind: "bottle",
          bottleId: legacyPromotedBottleId,
        });
        return true;
      }

      if (input?.bottle === retiredParentBottleId) {
        sendRpcResponse(response, { kind: "group", groupId: bottleGroupId });
        return true;
      }

      if (input?.bottle === missingPageTargetBottleId) {
        sendRpcNotFound(response, "Bottle page target not found.");
        return true;
      }

      if (input?.bottle === conflictingPageTargetBottleId) {
        sendRpcConflict(response, "Bottle page target is ambiguous.");
        return true;
      }

      if (typeof input?.bottle !== "number") {
        sendRpcError(response, "Unexpected Bottle page target payload");
        return true;
      }

      sendRpcResponse(response, {
        kind: "bottle",
        bottleId: getMockExactTarget(request, input.bottle).bottle.id,
      });
      return true;
    }
    case "bottles/details": {
      if (
        input?.bottle === retiredParentBottleId ||
        input?.bottle === missingPageTargetBottleId ||
        input?.bottle === conflictingPageTargetBottleId
      ) {
        sendRpcNotFound(response, "Bottle not found.");
        return true;
      }

      if (input?.bottle === exactReplacementSourceBottleId) {
        sendRpcResponse(
          response,
          withTargetId(withCollectionStatus(request, legacyPromotedBottle)),
        );
        return true;
      }

      if (input?.bottle === createdBottleId) {
        const bottle = buildCreatedBottle({
          includeExactBottleDetails: isExactBottlePhotoScenario(request),
        });
        sendRpcResponse(
          response,
          withTargetId(withCollectionStatus(request, bottle)),
        );
        return true;
      }

      if (typeof input?.bottle !== "number") {
        sendRpcError(response, "Unexpected bottle details payload");
        return true;
      }

      if (input.bottle === groupedBottleDetails.id) {
        sendRpcResponse(
          response,
          withTargetId(withCollectionStatus(request, groupedBottleDetails)),
        );
        return true;
      }

      sendRpcResponse(
        response,
        withTargetId(
          withCollectionStatus(request, getMockBottle(request, input.bottle)),
        ),
      );
      return true;
    }
    case "bottles/list":
      if (!getAccessToken(request).includes("flight-targets")) return false;
      sendRpcResponse(response, {
        results: [withTargetId(existingBottle)],
        rel: { nextCursor: null, prevCursor: null },
      });
      return true;
    case "bottles/target": {
      if (typeof input?.bottle !== "number") {
        sendRpcError(response, "Unexpected Bottle target payload");
        return true;
      }
      sendRpcResponse(response, getMockExactTarget(request, input.bottle));
      return true;
    }
    case "bottleReleases/target": {
      if (
        input?.bottle === existingBottleId &&
        input?.release === legacyIncompleteReleaseId
      ) {
        sendRpcConflict(
          response,
          "Legacy BottleRelease mapping is incomplete.",
        );
        return true;
      }

      if (
        input?.bottle === existingBottleId &&
        input?.release === existingReleaseId
      ) {
        sendRpcResponse(response, { bottleId: legacyPromotedBottleId });
        return true;
      }

      sendRpcNotFound(response, "Legacy BottleRelease mapping not found.");
      return true;
    }
    case "bottles/suggestedTags":
      if (![createdBottleId, existingBottleId].includes(input?.bottle)) {
        sendRpcError(response, "Unexpected suggested tags payload");
        return true;
      }

      sendRpcResponse(response, suggestedTags);
      return true;
    case "tastings/create": {
      const target = getMockTarget(request, input?.target);
      if (
        !target ||
        input?.bottle !== undefined ||
        input?.release !== undefined ||
        input?.rating !== 2 ||
        ![
          tastingNotes,
          photoTastingNotes,
          genericTastingNotes,
          failingTastingNotes,
        ].includes(input?.notes)
      ) {
        sendRpcError(response, "Unexpected tasting create payload");
        return true;
      }

      if (
        input?.notes === genericTastingNotes &&
        input?.flight !== "flight-qa"
      ) {
        sendRpcError(response, "Expected Flight for generic tasting");
        return true;
      }

      if (
        input?.notes === photoTastingNotes &&
        input?.pendingImageId !== "playwright-photo-upload"
      ) {
        sendRpcError(response, "Expected pending image for photo tasting");
        return true;
      }

      if (input?.notes === failingTastingNotes) {
        await delay(500);
        sendRpcError(response, "Forced tasting create failure.");
        return true;
      }

      sendRpcResponse(response, {
        tasting: buildTasting({
          target,
          notes: input?.notes,
          rating: input?.rating,
          tags: input?.tags ?? [],
        }),
        awards: [],
      });
      return true;
    }
    case "tastings/photoIdentification":
      // E2E access-token suffixes select alternate mock photo-identification scenarios.
      if (getAccessToken(request).includes("photo-unauthorized")) {
        sendRpcUnauthorized(response);
        return true;
      }

      if (getAccessToken(request).includes("photo-create-warning")) {
        sendRpcResponse(response, buildCreateProposalPhotoIdentification());
        return true;
      }

      if (getAccessToken(request).includes("photo-create-existing")) {
        sendRpcResponse(
          response,
          buildCreateProposalPhotoIdentification(),
          "77777777777777777777777777777777",
        );
        return true;
      }

      if (getAccessToken(request).includes("photo-create-unsuitable")) {
        sendRpcResponse(
          response,
          buildCreateProposalPhotoIdentification({
            suitableAsBottleImage: false,
          }),
          "44444444444444444444444444444444",
        );
        return true;
      }

      if (getAccessToken(request).includes("photo-create-complete-bottle")) {
        sendRpcResponse(
          response,
          buildCreateProposalPhotoIdentification({
            includeExactBottleDetails: true,
          }),
          "22222222222222222222222222222222",
        );
        return true;
      }

      if (getAccessToken(request).includes("photo-create-prefilled-bottle")) {
        sendRpcResponse(
          response,
          buildCreateProposalPhotoIdentification({
            includeExactBottleDetails: true,
          }),
          "88888888888888888888888888888888",
        );
        return true;
      }

      if (
        getAccessToken(request).includes("photo-create-bottle-default-image")
      ) {
        sendRpcResponse(
          response,
          buildCreateProposalPhotoIdentification(),
          "44444444444444444444444444444444",
        );
        return true;
      }

      if (getAccessToken(request).includes("photo-no-match")) {
        sendRpcResponse(
          response,
          buildNoMatchPhotoIdentification(),
          "55555555555555555555555555555555",
        );
        return true;
      }

      if (getAccessToken(request).includes("photo-manual-match")) {
        sendRpcResponse(
          response,
          buildManualSearchMatchPhotoIdentification(),
          "413c334005c60d8dcc8dbf109761c5e3",
        );
        return true;
      }

      if (getAccessToken(request).includes("photo-needs-review")) {
        sendRpcResponse(
          response,
          buildNeedsReviewPhotoIdentification(),
          "66666666666666666666666666666666",
        );
        return true;
      }

      sendRpcResponse(
        response,
        {
          pendingImage: {
            id: "playwright-photo-upload",
            imageUrl: "http://127.0.0.1:4999/uploads/playwright-photo.webp",
            expiresAt: "2026-06-07T13:00:00.000Z",
          },
          imageEvidence: {
            sourceImageId: "playwright-photo-upload",
            sourceImageHash: "playwright-photo-hash",
            extractors: [
              {
                kind: "vision",
                model: "playwright",
                confidence: 0.95,
                textSpans: [
                  {
                    text: "Lagavulin 16",
                    confidence: 0.95,
                  },
                ],
                observations: ["Single bottle label is readable."],
              },
            ],
            fieldCandidates: {
              brand: {
                value: testBrand.name,
                confidence: 0.98,
                sourceExtractorIndexes: [0],
              },
              expression: {
                value: existingBottle.name,
                confidence: 0.94,
                sourceExtractorIndexes: [0],
              },
              statedAge: {
                value: 16,
                confidence: 0.94,
                sourceExtractorIndexes: [0],
              },
            },
            photoSuitability: {
              isSingleBottlePhoto: true,
              labelReadable: true,
              suitableAsTastingImage: true,
              suitableAsBottleImage: true,
              reason: null,
            },
            conflicts: [],
          },
          classification: {
            status: "classified",
            decision: {
              action: "match",
              matchedTarget: buildExactCatalogTarget(),
            },
            artifacts: {
              candidates: [
                {
                  bottleId: existingBottleId,
                  releaseId: null,
                  bottleFullName: existingBottle.fullName,
                  fullName: existingBottle.fullName,
                },
              ],
            },
          },
          suggestedNextStep: "confirm_match",
          diagnostics: {
            extraction: {
              status: "found",
              summary: "Lagavulin 16",
            },
            candidates: {
              count: 1,
            },
            classification: {
              status: "classified",
              action: "match",
              confidence: 95,
              reason: "Matched the fixture bottle.",
            },
          },
        },
        "11111111111111111111111111111111",
      );
      return true;
    case "tastings/photoIdentificationCreate":
      sendRpcResponse(
        response,
        createPhotoIdentificationTarget(request, input),
      );
      return true;
    case "tastings/imageUpdate":
      sendRpcResponse(response, {
        imageUrl: "http://127.0.0.1:4999/uploads/tasting.webp",
      });
      return true;
    case "tastings/details":
      if (input?.tasting !== createdTastingId) {
        sendRpcError(response, "Unexpected tasting details payload");
        return true;
      }

      sendRpcResponse(response, buildTasting());
      return true;
    case "users/details":
      if (getAccessToken(request).includes("photo-unauthorized-expired")) {
        sendRpcUnauthorized(response);
        return true;
      }

      if (
        input?.user === "me" ||
        input?.user === testUser.id ||
        input?.user === testUser.username
      ) {
        sendRpcResponse(response, testUser);
        return true;
      }

      sendRpcError(response, "Unexpected user details payload");
      return true;
    case "users/libraryStats":
      sendRpcResponse(response, emptyLibraryStats);
      return true;
    case "users/badgeList":
      sendRpcResponse(response, emptyList);
      return true;
    case "users/regionList":
      sendRpcResponse(response, {
        results: [],
        totalCount: 0,
      });
      return true;
    case "users/flavorList":
      sendRpcResponse(response, {
        results: [],
        totalCount: 0,
        totalScore: 0,
      });
      return true;
    case "notifications/count":
      sendRpcResponse(response, { count: 0 });
      return true;
    case "collections/bottles/list":
      sendRpcResponse(response, listCollectionBottles(request, input));
      return true;
    case "collections/bottles/create":
      if (getAccessToken(request).includes("library-create-failure")) {
        sendRpcError(response, "Could not save to Library.");
        return true;
      }
      if (getAccessToken(request).includes("library-create-slow")) {
        await delay(500);
      }
      sendRpcResponse(
        response,
        mutateCollectionBottle(request, input, "create"),
      );
      return true;
    case "bottles/imageUpdate":
      if (
        input?.bottle !== createdBottleId ||
        input.__mockHasUploadFile !== true
      ) {
        sendRpcError(response, "Unexpected Bottle image update payload");
        return true;
      }
      if (getAccessToken(request).includes("bottle-image-upload-failure")) {
        sendRpcError(response, "Could not upload Bottle image.");
        return true;
      }
      sendRpcResponse(response, {
        imageUrl: "http://127.0.0.1:4999/uploads/created-bottle.webp",
      });
      return true;
    case "pendingUploads/create":
      sendRpcResponse(response, createPendingUpload(request, input));
      return true;
    case "collections/bottles/imageUpdate":
      sendRpcResponse(response, updateCollectionBottleImage(request, input));
      return true;
    case "collections/bottles/update":
      sendRpcResponse(response, updateCollectionBottleStatus(request, input));
      return true;
    case "collections/bottles/delete":
      mutateCollectionBottle(request, input, "delete");
      sendRpcResponse(response, {});
      return true;
    case "bottles/tags":
      if (typeof input?.bottle !== "number") {
        sendRpcError(response, "Unexpected bottle tags payload");
        return true;
      }

      sendRpcResponse(response, {
        results: [],
        totalCount: 0,
      });
      return true;
    case "comments/list":
      sendRpcResponse(response, emptyList);
      return true;
    case "reviews/list":
      if (input?.bottle !== undefined && typeof input.bottle !== "number") {
        sendRpcError(response, "Unexpected reviews list payload");
        return true;
      }

      sendRpcResponse(response, emptyList);
      return true;
    default:
      return false;
  }
}

/**
 * Collection state is isolated by access token so parallel browser projects can
 * mutate Favorites and Library independently against one mock RPC server.
 */
function getCollectionState(request) {
  const token = getAccessToken(request);

  if (!collectionStateByToken.has(token)) {
    const library = new Map();
    if (token.includes("library-generic")) {
      const genericEntry = buildCollectionBottle({
        id: collectionBottleId++,
        target: buildGenericCatalogTarget(),
        hasTasted: true,
      });
      library.set(genericEntry.target.targetId, genericEntry);
    }
    collectionStateByToken.set(token, {
      default: new Map(),
      library,
    });
  }

  return collectionStateByToken.get(token);
}

function getPendingUploadState(request) {
  const token = getAccessToken(request);

  if (!pendingUploadStateByToken.has(token)) {
    pendingUploadStateByToken.set(token, new Map());
  }

  return pendingUploadStateByToken.get(token);
}

function getAccessToken(request) {
  const authorization = request.headers.authorization;
  return (
    (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(
      /^Bearer\s+/i,
      "",
    ) ?? "anonymous"
  );
}

function createPendingUpload(request, input) {
  if (input?.__mockHasUploadFile !== true) {
    throw new Error("Expected pending upload file payload");
  }

  const purpose = input?.purpose ?? "photo_tasting_entry";
  if (purpose !== "photo_tasting_entry") {
    throw new Error("Unexpected pending upload purpose");
  }
  if (typeof input?.idempotencyKey !== "string" || !input.idempotencyKey) {
    throw new Error("Expected pending upload idempotency key");
  }

  const uploads = getPendingUploadState(request);
  for (const upload of uploads.values()) {
    if (
      upload.purpose === purpose &&
      upload.idempotencyKey === input.idempotencyKey
    ) {
      return upload;
    }
  }

  const id = `playwright-library-upload-${pendingUploadId++}`;
  const upload = {
    id,
    imageUrl: `http://127.0.0.1:4999/uploads/${id}.webp`,
    kind: "image",
    purpose,
    status: "pending",
    idempotencyKey: input.idempotencyKey,
    expiresAt: "2026-06-07T13:00:00.000Z",
  };

  uploads.set(id, upload);
  return upload;
}

function getCollection(input) {
  if (input?.collection !== "default" && input?.collection !== "library") {
    throw new Error(`Unexpected collection ${input?.collection}`);
  }

  return input.collection;
}

function getLegacyCollectionRelease(input) {
  if (input?.release === undefined || input.release === null) return null;

  if (
    input.release === existingReleaseId &&
    input.bottle === existingRelease.bottleId
  ) {
    return existingRelease;
  }
  throw new Error("Unexpected collection release payload");
}

function buildLegacyCollectionTarget(request, input) {
  if (typeof input?.bottle !== "number") {
    throw new Error("Expected target or retained bottle collection identity");
  }

  const bottle =
    input.bottle === existingBottleId
      ? existingBottle
      : input.bottle === createdBottleId
        ? buildCreatedBottle({
            includeExactBottleDetails: isExactBottlePhotoScenario(request),
          })
        : buildBottleForId(input.bottle);

  return buildExactCatalogTarget({
    bottle,
    release: getLegacyCollectionRelease(input),
  });
}

function resolveCollectionMutationTarget(request, entries, input) {
  if (input?.target !== undefined) {
    if (typeof input.target !== "number" || input?.bottle !== undefined) {
      throw new Error("Unexpected target collection mutation payload");
    }

    const target =
      Array.from(entries.values()).find(
        (entry) => entry.target.targetId === input.target,
      )?.target ?? getMockTarget(request, input.target);
    if (!target) {
      throw new Error("Unknown CatalogTarget collection mutation payload");
    }
    return target;
  }

  return buildLegacyCollectionTarget(request, input);
}

function mutateCollectionBottle(request, input, action) {
  if (input?.user !== "me") {
    throw new Error("Unexpected collection mutation payload");
  }
  if (
    input?.pendingImageId !== undefined &&
    input.pendingImageId !== "playwright-photo-upload"
  ) {
    throw new Error("Unexpected collection pending image payload");
  }

  const state = getCollectionState(request);
  const collection = getCollection(input);
  const entries = state[collection];
  const target = resolveCollectionMutationTarget(request, entries, input);
  const key = target.targetId;

  if (action === "delete") {
    entries.delete(key);
    return;
  }

  if (!entries.has(key)) {
    entries.set(
      key,
      buildCollectionBottle({
        id: collectionBottleId++,
        target,
        imageUrl: input.pendingImageId
          ? "http://127.0.0.1:4999/uploads/library.webp"
          : null,
        status: input.status ?? null,
      }),
    );
  } else {
    const entry = entries.get(key);
    if (!entry) {
      throw new Error("Collection entry missing after key lookup");
    }
    if (!input.pendingImageId) return entry;

    entries.set(key, {
      ...entry,
      imageUrl: "http://127.0.0.1:4999/uploads/library.webp",
    });
  }

  return entries.get(key);
}

function findCollectionBottleEntry(request, input) {
  if (
    input?.user !== "me" &&
    input?.user !== testUser.username &&
    input?.user !== testUser.id
  ) {
    throw new Error("Unexpected collection image user payload");
  }
  if (input?.collection !== "library") {
    throw new Error("Unexpected collection image collection payload");
  }
  if (typeof input?.collectionBottle !== "number") {
    throw new Error("Unexpected collection image entry payload");
  }

  const entries = getCollectionState(request).library;
  const entry = Array.from(entries.values()).find(
    (candidate) => candidate.id === input.collectionBottle,
  );
  if (!entry) {
    throw new Error("Collection entry missing for image mutation");
  }

  return entry;
}

function replaceCollectionBottleEntry(request, updatedEntry) {
  const entries = getCollectionState(request).library;
  for (const [key, entry] of entries.entries()) {
    if (entry.id === updatedEntry.id) {
      entries.set(key, updatedEntry);
      return updatedEntry;
    }
  }

  throw new Error("Collection entry missing for image replacement");
}

function updateCollectionBottleStatus(request, input) {
  if (![null, "sealed", "open", "empty"].includes(input?.status)) {
    throw new Error("Unexpected collection bottle status payload");
  }

  const entry = findCollectionBottleEntry(request, input);
  return replaceCollectionBottleEntry(request, {
    ...entry,
    status: input.status,
  });
}

function updateCollectionBottleImage(request, input) {
  const entry = findCollectionBottleEntry(request, input);
  const uploads = getPendingUploadState(request);
  if (!uploads.has(input?.pendingImageId)) {
    throw new Error("Unexpected collection image pending upload payload");
  }

  return replaceCollectionBottleEntry(request, {
    ...entry,
    imageUrl: `http://127.0.0.1:4999/uploads/library-replaced-${entry.id}.webp`,
  });
}

function buildCreateProposalPhotoIdentification({
  includeExactBottleDetails = false,
  suitableAsBottleImage = true,
} = {}) {
  const proposedBottle = {
    name: createdBottleName,
    category: "single_malt",
    series: null,
    edition: includeExactBottleDetails ? "First Fill Oloroso" : null,
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    abv: includeExactBottleDetails ? 46 : null,
    vintageYear: null,
    releaseYear: includeExactBottleDetails ? 2026 : null,
    brand: {
      id: testBrand.id,
      name: testBrand.name,
    },
    distillers: [
      {
        id: testBrand.id,
        name: testBrand.name,
      },
    ],
    bottler: null,
  };
  const decision = {
    action: "create_bottle",
    proposedBottle,
  };

  return {
    pendingImage: {
      id: "playwright-photo-upload",
      imageUrl: "http://127.0.0.1:4999/uploads/playwright-photo.webp",
      expiresAt: "2026-06-07T13:00:00.000Z",
    },
    imageEvidence: {
      sourceImageId: "playwright-photo-upload",
      sourceImageHash: "playwright-photo-hash",
      extractors: [
        {
          kind: "vision",
          model: "playwright",
          confidence: 0.92,
          textSpans: [
            {
              text: `${testBrand.name} ${createdBottleName}`,
              confidence: 0.92,
            },
          ],
          observations: ["Single bottle label is readable."],
        },
      ],
      fieldCandidates: {
        brand: {
          value: testBrand.name,
          confidence: 0.95,
          sourceExtractorIndexes: [0],
        },
        expression: {
          value: createdBottleName,
          confidence: 0.9,
          sourceExtractorIndexes: [0],
        },
        series: {
          value: "Playwright Series",
          confidence: 0.88,
          sourceExtractorIndexes: [0],
        },
        distillery: {
          value: [testBrand.name],
          confidence: 0.89,
          sourceExtractorIndexes: [0],
        },
        category: {
          value: "single_malt",
          confidence: 0.87,
          sourceExtractorIndexes: [0],
        },
        edition:
          proposedBottle.edition === null
            ? undefined
            : {
                value: proposedBottle.edition,
                confidence: 0.88,
                sourceExtractorIndexes: [0],
              },
      },
      photoSuitability: {
        isSingleBottlePhoto: true,
        labelReadable: true,
        suitableAsTastingImage: true,
        suitableAsBottleImage,
        reason: suitableAsBottleImage
          ? null
          : "The photo is not suitable as a public catalog image.",
      },
      conflicts: [],
    },
    classification: {
      status: "classified",
      decision,
      artifacts: {
        candidates: [
          {
            bottleId: existingBottleId,
            releaseId: null,
            bottleFullName: existingBottle.fullName,
            fullName: existingBottle.fullName,
          },
        ],
      },
    },
    suggestedNextStep: "confirm_create",
    diagnostics: {
      extraction: {
        status: "found",
        summary: `${testBrand.name} ${createdBottleName}`,
      },
      candidates: {
        count: 1,
      },
      classification: {
        status: "classified",
        action: "create_bottle",
        confidence: 92,
        reason: "Create proposal fixture.",
      },
    },
    createToken: `playwright-create-token:create_bottle:${suitableAsBottleImage ? "suitable" : "unsuitable"}`,
  };
}

function createPhotoIdentificationTarget(request, input) {
  const expectedCreateToken = getExpectedPhotoCreateToken(request);
  if (input?.createToken !== expectedCreateToken) {
    throw new Error("Unexpected photo identification create token");
  }

  const token = getAccessToken(request);
  const bottle = buildCreatedBottle({
    includeExactBottleDetails: isExactBottlePhotoScenario(request),
  });

  if (token.includes("photo-create-warning")) {
    return {
      target: buildExactCatalogTarget({ bottle }),
      warnings: [
        {
          code: "CATALOG_IMAGE_COPY_FAILED",
          message:
            "The bottle was created, but the public image was not saved.",
        },
      ],
    };
  }

  if (token.includes("photo-create-existing")) {
    return {
      target: buildExactCatalogTarget(),
    };
  }

  if (token.includes("photo-create-unsuitable")) {
    return {
      target: buildExactCatalogTarget({ bottle }),
    };
  }

  if (
    token.includes("photo-create-bottle-default-image") ||
    token.includes("photo-create-complete-bottle") ||
    token.includes("photo-create-prefilled-bottle")
  ) {
    return {
      target: buildExactCatalogTarget({ bottle }),
    };
  }

  throw new Error("Unexpected photo identification create scenario");
}

function getExpectedPhotoCreateToken(request) {
  const token = getAccessToken(request);
  if (token.includes("photo-create-unsuitable")) {
    return "playwright-create-token:create_bottle:unsuitable";
  }

  if (
    token.includes("photo-create-bottle-default-image") ||
    token.includes("photo-create-complete-bottle") ||
    token.includes("photo-create-prefilled-bottle") ||
    token.includes("photo-create-warning") ||
    token.includes("photo-create-existing")
  ) {
    return "playwright-create-token:create_bottle:suitable";
  }

  return null;
}

function isExactBottlePhotoScenario(request) {
  const token = getAccessToken(request);
  return (
    token.includes("photo-create-complete-bottle") ||
    token.includes("photo-create-prefilled-bottle") ||
    token.includes("proposal-release-library")
  );
}

function buildCreatedBottle({ includeExactBottleDetails = false } = {}) {
  const bottle = buildBottle({
    id: createdBottleId,
    name: createdBottleName,
    brand: testBrand,
  });
  if (!includeExactBottleDetails) return bottle;

  return {
    ...bottle,
    fullName: `${bottle.fullName} First Fill Oloroso`,
    edition: "First Fill Oloroso",
    abv: 46,
    releaseYear: 2026,
  };
}

const releaseOnlyQueueProposalId = 9911;
const releaseOnlyQueueEdition = "Cask 17";

function buildReleaseOnlyQueueBottle() {
  return {
    ...anotherReleaseSourceBottle,
    id: createdBottleId,
    fullName: `${anotherReleaseSourceBottle.brand.name} ${anotherReleaseSourceBottle.name} ${releaseOnlyQueueEdition}`,
    edition: releaseOnlyQueueEdition,
    abv: 52.3,
    releaseYear: 2025,
  };
}

function buildReleaseOnlyQueueProposal() {
  return {
    ...buildBottleAndReleaseProposal(),
    id: releaseOnlyQueueProposalId,
    creationTarget: "release",
    parentBottleId: anotherReleaseSourceBottle.id,
    proposedBottle: null,
    proposedRelease: {
      edition: releaseOnlyQueueEdition,
      statedAge: null,
      abv: 52.3,
      caskStrength: true,
      singleCask: true,
      vintageYear: 2008,
      releaseYear: 2025,
      caskType: "oloroso",
      caskSize: "hogshead",
      caskFill: "1st_fill",
      description: "Retailer release description.",
      tastingNotes: null,
    },
    price: {
      ...buildBottleAndReleaseProposal().price,
      id: 9912,
      name: `${anotherReleaseSourceBottle.fullName} ${releaseOnlyQueueEdition}`,
    },
    currentTarget: null,
    suggestedTarget: null,
    parentBottle: anotherReleaseSourceBottle,
  };
}

function isExpectedReleaseOnlyQueueCreateInput(input) {
  if (
    !input ||
    Object.keys(input).sort().join(",") !== "independentBottle,proposal" ||
    input.proposal !== releaseOnlyQueueProposalId
  ) {
    return false;
  }

  const bottle = input.independentBottle;
  const brandIsCanonical =
    bottle?.brand === testBrand.id ||
    (typeof bottle?.brand === "object" &&
      bottle.brand?.id === testBrand.id &&
      bottle.brand?.name === testBrand.name);

  return (
    brandIsCanonical &&
    bottle?.name === anotherReleaseSourceBottle.name &&
    bottle?.statedAge === anotherReleaseSourceBottle.statedAge &&
    bottle?.edition === releaseOnlyQueueEdition &&
    bottle?.abv === 52.3 &&
    bottle?.singleCask === true &&
    bottle?.caskStrength === true &&
    bottle?.vintageYear === 2008 &&
    bottle?.releaseYear === 2025 &&
    bottle?.caskType === "oloroso" &&
    bottle?.caskFill === "1st_fill" &&
    bottle?.caskSize === "hogshead" &&
    bottle?.description === "Retailer release description." &&
    bottle?.descriptionSrc === null &&
    bottle?.tastingNotes === null &&
    ![
      "bottle",
      "release",
      "sourceBottle",
      "sourceBottleId",
      "group",
      "groupId",
    ].some((field) => Object.hasOwn(bottle, field))
  );
}

function isExpectedOrdinaryExactBottleCreateInput(input) {
  const brandIsCanonical =
    input?.brand === testBrand.id ||
    (typeof input?.brand === "object" &&
      input.brand?.id === testBrand.id &&
      input.brand?.name === testBrand.name);

  return (
    input?.name === createdBottleName &&
    brandIsCanonical &&
    input?.edition === "Founder's Cask" &&
    input?.abv === 58.7 &&
    input?.releaseYear === 2025 &&
    input?.vintageYear === 2009 &&
    input?.singleCask === true &&
    input?.caskStrength === true &&
    input?.caskFill === "1st_fill" &&
    input?.caskType === "oloroso" &&
    input?.caskSize === "hogshead"
  );
}

function buildBottleAndReleaseProposal() {
  return {
    id: 9901,
    status: "pending_review",
    proposalType: "create_new",
    confidence: null,
    modelConfidence: 90,
    automationScore: 90,
    automationEligible: false,
    automationBlockers: [],
    decisiveMatchAttributes: [],
    plainAgeBottleAutoVerifyEligible: false,
    differentiatingAttributes: [],
    webEvidenceChecks: [],
    currentBottleId: null,
    currentReleaseId: null,
    suggestedBottleId: null,
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: "bottle_and_release",
    candidateBottles: [],
    extractedLabel: null,
    proposedBottle: {
      name: createdBottleName,
      series: null,
      category: "single_malt",
      edition: null,
      statedAge: null,
      caskStrength: null,
      singleCask: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      brand: { id: testBrand.id, name: testBrand.name },
      distillers: [{ id: testBrand.id, name: testBrand.name }],
      bottler: null,
    },
    proposedRelease: {
      edition: "First Fill Oloroso",
      statedAge: null,
      abv: null,
      caskStrength: null,
      singleCask: null,
      vintageYear: null,
      releaseYear: 2026,
      caskType: null,
      caskSize: null,
      caskFill: null,
      description: null,
      tastingNotes: null,
    },
    searchEvidence: [],
    rationale: null,
    model: "playwright",
    error: null,
    lastEvaluatedAt: null,
    reviewedAt: null,
    isProcessing: false,
    processingQueuedAt: null,
    processingExpiresAt: null,
    createdAt: "2026-06-07T12:00:00.000Z",
    updatedAt: "2026-06-07T12:00:00.000Z",
    price: {
      id: 9902,
      name: `${testBrand.name} ${createdBottleName}`,
      price: 99,
      currency: "usd",
      imageUrl: null,
      url: "https://example.test/bottle",
      volume: 750,
      updatedAt: "2026-06-07T12:00:00.000Z",
      isValid: true,
      target: null,
      site: {
        id: 9903,
        name: "Playwright Store",
        type: "woodencork",
        lastRunAt: null,
        nextRunAt: null,
        runEvery: null,
      },
    },
    currentBottle: null,
    currentRelease: null,
    suggestedBottle: null,
    suggestedRelease: null,
    parentBottle: null,
  };
}

/**
 * Builds the no-match photo-identification RPC fixture for Add Bottle fallback tests.
 */
function buildNoMatchPhotoIdentification() {
  return {
    pendingImage: {
      id: "playwright-photo-upload",
      imageUrl: "http://127.0.0.1:4999/uploads/playwright-photo.webp",
      expiresAt: "2026-06-07T13:00:00.000Z",
    },
    imageEvidence: {
      sourceImageId: "playwright-photo-upload",
      sourceImageHash: "playwright-photo-hash",
      extractors: [
        {
          kind: "vision",
          model: "playwright",
          confidence: 0.82,
          textSpans: [
            {
              text: `${testBrand.name} ${createdBottleName}`,
              confidence: 0.82,
            },
          ],
          observations: ["Single bottle label is readable."],
        },
      ],
      fieldCandidates: {
        brand: {
          value: testBrand.name,
          confidence: 0.82,
          sourceExtractorIndexes: [0],
        },
        expression: {
          value: createdBottleName,
          confidence: 0.8,
          sourceExtractorIndexes: [0],
        },
        distillery: {
          value: [testBrand.name],
          confidence: 0.79,
          sourceExtractorIndexes: [0],
        },
        edition: {
          value: "Single Cask",
          confidence: 0.78,
          sourceExtractorIndexes: [0],
        },
        vintageYear: {
          value: 2007,
          confidence: 0.78,
          sourceExtractorIndexes: [0],
        },
        releaseYear: {
          value: 2016,
          confidence: 0.78,
          sourceExtractorIndexes: [0],
        },
        caskNumber: {
          value: "1661",
          confidence: 0.76,
          sourceExtractorIndexes: [0],
        },
      },
      photoSuitability: {
        isSingleBottlePhoto: true,
        labelReadable: true,
        suitableAsTastingImage: true,
        suitableAsBottleImage: true,
        reason: "The label is readable.",
      },
      conflicts: [],
    },
    classification: {
      status: "classified",
      decision: {
        action: "no_match",
      },
      artifacts: {
        candidates: [],
      },
    },
    suggestedNextStep: "manual_search",
    diagnostics: {
      extraction: {
        status: "found",
        summary: `${testBrand.name} ${createdBottleName}`,
      },
      candidates: {
        count: 0,
      },
      classification: {
        status: "classified",
        action: "no_match",
        confidence: 0,
        reason: "No existing Peated bottle matched the label details.",
      },
    },
  };
}

function buildManualSearchMatchPhotoIdentification() {
  return {
    pendingImage: {
      id: "playwright-photo-upload",
      imageUrl: "http://127.0.0.1:4999/uploads/playwright-photo.webp",
      expiresAt: "2026-06-07T13:00:00.000Z",
    },
    imageEvidence: {
      sourceImageId: "playwright-photo-upload",
      sourceImageHash: "playwright-photo-hash",
      extractors: [
        {
          kind: "vision",
          model: "playwright",
          confidence: 0.75,
          textSpans: [
            {
              text: `${testBrand.name} ${existingBottle.name} 2022 release`,
              confidence: 0.75,
            },
          ],
          observations: ["Single bottle label is readable."],
        },
      ],
      fieldCandidates: {
        brand: {
          value: testBrand.name,
          confidence: 0.75,
          sourceExtractorIndexes: [0],
        },
        expression: {
          value: existingBottle.name,
          confidence: 0.75,
          sourceExtractorIndexes: [0],
        },
        releaseYear: {
          value: 2022,
          confidence: 0.75,
          sourceExtractorIndexes: [0],
        },
      },
      photoSuitability: {
        isSingleBottlePhoto: true,
        labelReadable: true,
        suitableAsTastingImage: true,
        suitableAsBottleImage: true,
        reason: null,
      },
      conflicts: [],
    },
    classification: {
      status: "classified",
      decision: {
        action: "match",
        matchedTarget: buildExactCatalogTarget({
          bottle: legacyPromotedBottle,
        }),
      },
      artifacts: {
        candidates: [
          {
            bottleId: existingBottleId,
            releaseId: existingReleaseId,
            bottleFullName: existingBottle.fullName,
            fullName: existingRelease.fullName,
          },
          {
            bottleId: existingBottleId,
            releaseId: null,
            bottleFullName: existingBottle.fullName,
            fullName: existingBottle.fullName,
          },
        ],
      },
    },
    suggestedNextStep: "manual_search",
    diagnostics: {
      extraction: {
        status: "found",
        summary: `${testBrand.name} ${existingBottle.name} 2022 release`,
      },
      candidates: {
        count: 2,
      },
      classification: {
        status: "classified",
        action: "match",
        confidence: null,
        reason:
          "Local release candidate safely matches, but the next step was downgraded.",
      },
    },
  };
}

function buildNeedsReviewPhotoIdentification() {
  return {
    pendingImage: {
      id: "playwright-photo-upload",
      imageUrl: "http://127.0.0.1:4999/uploads/playwright-photo.webp",
      expiresAt: "2026-06-07T13:00:00.000Z",
    },
    imageEvidence: {
      sourceImageId: "playwright-photo-upload",
      sourceImageHash: "playwright-photo-hash",
      extractors: [
        {
          kind: "vision",
          model: "playwright",
          confidence: 0.72,
          textSpans: [
            {
              text: `${testBrand.name} ${existingBottle.name}`,
              confidence: 0.72,
            },
          ],
          observations: ["Single bottle label is partly readable."],
        },
      ],
      fieldCandidates: {
        brand: {
          value: testBrand.name,
          confidence: 0.72,
          sourceExtractorIndexes: [0],
        },
        expression: {
          value: existingBottle.name,
          confidence: 0.68,
          sourceExtractorIndexes: [0],
        },
      },
      photoSuitability: {
        isSingleBottlePhoto: true,
        labelReadable: true,
        suitableAsTastingImage: true,
        suitableAsBottleImage: false,
        reason: "The photo is too uncertain for catalog creation.",
      },
      conflicts: [],
    },
    classification: {
      status: "classified",
      decision: {
        action: "match",
        matchedTarget: buildExactCatalogTarget(),
      },
      artifacts: {
        candidates: [
          {
            bottleId: existingBottleId,
            releaseId: null,
            bottleFullName: existingBottle.fullName,
            fullName: existingBottle.fullName,
          },
        ],
      },
    },
    suggestedNextStep: "needs_review",
    diagnostics: {
      extraction: {
        status: "found",
        summary: `${testBrand.name} ${existingBottle.name}`,
      },
      candidates: {
        count: 1,
      },
      classification: {
        status: "classified",
        action: "match",
        confidence: 55,
        reason: "Possible match needs user review.",
      },
    },
  };
}

/**
 * Mirrors authenticated bottle status fields from the mock collection state.
 */
function withCollectionStatus(request, bottle) {
  const state = getCollectionState(request);

  return {
    ...bottle,
    isFavorite: hasBottleInCollection(state.default, bottle.id),
    isLibrary: hasBottleInCollection(state.library, bottle.id),
  };
}

function getMockBottle(request, bottleId) {
  if (bottleId === existingBottleId) {
    return getAccessToken(request).includes("add-another-release")
      ? addAnotherReleaseSourceBottle
      : existingBottle;
  }
  if (bottleId === createdBottleId) {
    return buildCreatedBottle({
      includeExactBottleDetails: isExactBottlePhotoScenario(request),
    });
  }
  if (bottleId === groupedBottleDetails.id) return groupedBottleDetails;
  const groupMember = bottleGroupMemberTargets.find(
    (target) => target.bottle.id === bottleId,
  );
  if (groupMember) {
    return { ...groupMember.bottle, group: groupMember.group };
  }
  if (bottleId === exactSearchBottle.id) return exactSearchBottle;
  if (bottleId === legacyPromotedBottleId) return legacyPromotedBottle;
  return buildBottleForId(bottleId);
}

function withTargetId(bottle) {
  const groupedTarget = bottleGroupMemberTargets.find(
    (target) => target.bottle.id === bottle.id,
  );
  return {
    ...bottle,
    targetId:
      groupedTarget?.targetId ?? buildExactCatalogTarget({ bottle }).targetId,
  };
}

function getMockExactTarget(request, bottleId) {
  return (
    bottleGroupMemberTargets.find((target) => target.bottle.id === bottleId) ??
    buildExactCatalogTarget({ bottle: getMockBottle(request, bottleId) })
  );
}

function getMockTarget(request, targetId) {
  if (typeof targetId !== "number") return null;

  const exactTargets = [
    existingBottleId,
    createdBottleId,
    exactSearchBottle.id,
    legacyPromotedBottleId,
  ].map((bottleId) => getMockExactTarget(request, bottleId));
  const targets = [
    ...exactTargets,
    ...bottleGroupMemberTargets,
    bottleGroupTarget,
    destinationBottleGroupTarget,
    splitBottleGroupTarget,
    buildGenericCatalogTarget(),
  ];
  const knownTarget = targets.find((target) => target.targetId === targetId);
  if (knownTarget) return knownTarget;

  const bottleId = targetId - 10_000_000;
  if (bottleId > 0 && bottleId < 10_000_000 && Number.isSafeInteger(bottleId)) {
    return getMockExactTarget(request, bottleId);
  }

  return null;
}

function hasBottleInCollection(collection, bottleId) {
  return Array.from(collection.values()).some(
    (entry) =>
      entry.target.kind === "bottle" && entry.target.bottle.id === bottleId,
  );
}

function buildBottleForId(id) {
  if (id === createdBottleId) {
    return buildBottle({
      id: createdBottleId,
      name: createdBottleName,
      brand: testBrand,
    });
  }

  if (id === bottleImageBottleId) {
    return buildBottle({
      id: bottleImageBottleId,
      name: "Bottle Image Reserve",
      imageUrl: bottleImageUrl,
    });
  }

  return buildBottle({
    id,
    name: `16-year-old ${id}`,
  });
}

function listCollectionBottles(request, input) {
  const state = getCollectionState(request);
  const collection = getCollection(input);
  const entries = Array.from(state[collection].entries());
  let results = entries.map(([, entry]) => entry);

  if (input?.target !== undefined) {
    results = results.filter(
      (entry) => entry.target.targetId === Number(input.target),
    );
  } else if (input?.bottle !== undefined) {
    const target = buildLegacyCollectionTarget(request, input);
    results = results.filter(
      (entry) => entry.target.targetId === target.targetId,
    );
  }

  if (collection === "library" && input?.query) {
    const query = String(input.query).toLowerCase();
    results = results.filter((entry) =>
      getCollectionTargetOwner(entry.target)
        .fullName.toLowerCase()
        .includes(query),
    );
  }

  if (collection === "library" && input?.brand) {
    results = results.filter(
      (entry) =>
        getCollectionTargetOwner(entry.target).brandId === Number(input.brand),
    );
  }

  if (collection === "library" && input?.distiller) {
    results = results.filter((entry) =>
      getCollectionTargetOwner(entry.target).distillerIds.includes(
        Number(input.distiller),
      ),
    );
  }

  if (collection === "library" && input?.status) {
    results = results.filter((entry) =>
      input.status === "unset"
        ? entry.status === null
        : entry.status === input.status,
    );
  }

  return {
    results,
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
}

function getCollectionTargetOwner(target) {
  return target.kind === "bottle" ? target.bottle : target.group;
}

function getBottleGroupTarget(groupId) {
  switch (groupId) {
    case bottleGroupId:
      return bottleGroupTarget;
    case destinationBottleGroupId:
      return destinationBottleGroupTarget;
    case splitBottleGroupId:
      return splitBottleGroupTarget;
    default:
      return null;
  }
}

function isExpectedBottleGroupSplitInput(input) {
  return (
    input?.group === bottleGroupId &&
    Array.isArray(input.movedBottleIds) &&
    input.movedBottleIds.length === 1 &&
    input.movedBottleIds[0] === bottleGroupRepresentative.id &&
    input.newRepresentativeBottleId === bottleGroupRepresentative.id &&
    input.sourceRepresentativeBottleId ===
      bottleGroupMemberTargets[1].bottle.id &&
    Object.keys(input).length === 4
  );
}

async function readRpcInput(request, url) {
  const data = url.searchParams.get("data");
  if (data) {
    return JSON.parse(data).json;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentType = request.headers["content-type"] ?? "";
  if (
    typeof contentType === "string" &&
    contentType.includes("multipart/form-data")
  ) {
    return await readMultipartRpcInput(request, contentType);
  }

  if (
    typeof contentType === "string" &&
    !contentType.includes("application/json")
  ) {
    request.resume();
    return {};
  }

  const body = await readBody(request);
  if (!body) return undefined;

  return JSON.parse(body).json;
}

async function readMultipartRpcInput(request, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) {
    request.resume();
    return {};
  }

  const body = await readBody(request, "latin1");
  const parts = body.split(`--${boundary}`);
  let data;
  let hasUploadFile = false;

  for (const part of parts) {
    const separatorIndex = part.indexOf("\r\n\r\n");
    if (separatorIndex === -1) continue;

    const headers = part.slice(0, separatorIndex);
    const name = headers.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;

    const value = part.slice(separatorIndex + 4).replace(/\r\n$/, "");
    if (name === "data") {
      data = JSON.parse(value).json;
    } else if (/^\d+$/.test(name)) {
      hasUploadFile = true;
    }
  }

  return {
    ...(data && typeof data === "object" ? data : {}),
    __mockHasUploadFile: hasUploadFile,
  };
}

function readBody(request, encoding = "utf8") {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding(encoding);
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendRpcResponse(response, data, sentryTraceId = null) {
  response
    .writeHead(200, {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(sentryTraceId ? { "x-sentry-trace-id": sentryTraceId } : {}),
    })
    .end(JSON.stringify({ json: data }));
}

function sendRpcError(response, message) {
  response
    .writeHead(400, {
      ...corsHeaders,
      "Content-Type": "application/json",
    })
    .end(JSON.stringify({ error: { code: "BAD_REQUEST", message } }));
}

function sendRpcUnauthorized(response) {
  response
    .writeHead(401, {
      ...corsHeaders,
      "Content-Type": "application/json",
    })
    .end(
      JSON.stringify({
        json: {
          defined: true,
          code: "UNAUTHORIZED",
          status: 401,
          message: "Unauthorized.",
        },
      }),
    );
}

function sendRpcNotFound(response, message) {
  response
    .writeHead(404, {
      ...corsHeaders,
      "Content-Type": "application/json",
    })
    .end(
      JSON.stringify({
        json: {
          defined: true,
          code: "NOT_FOUND",
          status: 404,
          message,
        },
      }),
    );
}

function sendRpcConflict(response, message) {
  response
    .writeHead(409, {
      ...corsHeaders,
      "Content-Type": "application/json",
    })
    .end(
      JSON.stringify({
        json: {
          defined: true,
          code: "CONFLICT",
          status: 409,
          message,
        },
      }),
    );
}
