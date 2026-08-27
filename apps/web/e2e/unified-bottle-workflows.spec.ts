import { expect, type Request, test, type TestInfo } from "@playwright/test";
import { z } from "zod";

import { bottlePath, expectNoHorizontalOverflow } from "./assertions";
import {
  anotherReleaseSourceBottle,
  createdBottleName,
  exactMergeOtherBottle,
  exactMergeOtherBottleId,
  existingBottleId,
  testAccessToken,
  testBrand,
  testUser,
  unifiedBottleEditContext,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("unified Bottle workflows", () => {
  test("creates a Bottle from one focused listing task", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "queue-direct-bottle"),
      user: { ...testUser, admin: true, mod: true },
    });

    await page.goto("/admin/moderation/inbox/listing/9911");

    await expect(
      page.getByRole("heading", {
        name: "Should this Bottle be added to the catalog?",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Proposed Bottle" }),
    ).toBeVisible();
    await expect(page.getByText("16", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Bottle" }),
    ).toBeVisible();

    const createRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/prices/matchQueue/createBottle"),
    );
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await createRequestPromise);

    expect(Object.keys(input).sort()).toEqual([
      "independentBottle",
      "proposal",
    ]);
    const independentBottle = getRecord(input, "independentBottle");
    expect(independentBottle.name).toBe(anotherReleaseSourceBottle.name);
    expect(independentBottle.statedAge).toBe(
      anotherReleaseSourceBottle.statedAge,
    );
    expect(independentBottle.edition).toBe("Cask 17");
    expect(independentBottle.abv).toBe(52.3);
    expect(independentBottle.singleCask).toBe(true);
    expect(independentBottle.caskStrength).toBe(true);
    expect(independentBottle.vintageYear).toBe(2008);
    expect(independentBottle.releaseYear).toBe(2025);
    expect(independentBottle.maturation).toBe("Oloroso hogshead");
    expect(independentBottle.outturn).toBe(240);
    expect(independentBottle.caskNumber).toBe("#5678");
    expect(independentBottle.description).toBeNull();
    expect(independentBottle.descriptionSrc).toBeNull();
    expect(independentBottle.tastingNotes).toBeUndefined();
    for (const legacyField of [
      "bottle",
      "release",
      "sourceBottle",
      "sourceBottleId",
      "group",
      "groupId",
    ]) {
      expect(input).not.toHaveProperty(legacyField);
      expect(independentBottle).not.toHaveProperty(legacyField);
    }

    await expect(page).toHaveURL("/admin/moderation/inbox");
    await expect(
      page.getByText("Nothing needs a decision", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("reviews an Incoming Listing follow-up as a focused catalog task", async ({
    context,
    page,
    request,
  }, testInfo) => {
    const accessToken = uniqueAccessToken(testInfo, "queue-linked-check");
    await signIn(context, {
      accessToken,
      user: { ...testUser, admin: true, mod: true },
    });

    const detailsResponse = await request.post(
      `${mockApiServer}/rpc/audits/details`,
      {
        data: { json: { audit: 92 } },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    expect(detailsResponse.ok()).toBe(true);
    const details = (await detailsResponse.json()).json;

    expect(details.audit).not.toHaveProperty("inputSnapshot");
    expect(details.audit).not.toHaveProperty("artifacts");
    expect(details.audit.modelMetadata).toMatchObject({
      usage: { totalTokens: 10_800 },
      cost: { estimatedAgentLoopCostUsd: 0.044 },
    });
    expect(details.audit).not.toHaveProperty("subjectKey");
    expect(details.audit).not.toHaveProperty("backgroundEventKey");
    expect(details.audit.output.decision).toMatchObject({
      aliasScope: null,
      confidenceBasis: null,
    });
    for (const operation of details.audit.operations) {
      expect(operation).not.toHaveProperty("stateToken");
    }
    for (const operation of details.reviewOperations) {
      expect(operation.review).not.toHaveProperty("stateToken");
    }
    await page.goto("/admin/moderation/inbox/operation/703");

    await expect(
      page.getByRole("heading", { name: "Merge these Bottle records?" }),
    ).toBeVisible();
    const reviewOperation = page.getByRole("article").filter({
      hasText: "The inspected listing matched the canonical Bottle",
    });
    await expect(reviewOperation).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const approvalRequest = page.waitForRequest((request) =>
      request.url().includes("/rpc/audits/approveSelected"),
    );
    await reviewOperation
      .getByRole("button", { name: "Apply included changes" })
      .click();
    await approvalRequest;
    await expect(page).toHaveURL("/admin/moderation/inbox");
    await expect(
      page.getByText("Nothing needs a decision", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates an independent Bottle from a source-backed proposal", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "add-another-release-proposal"),
      user: { ...testUser, mod: true },
    });
    const returnTo = `/bottles/${existingBottleId}`;

    await page.goto(
      `/bottles/${existingBottleId}/addRelease?proposal=9901&returnTo=${encodeURIComponent(returnTo)}`,
    );

    await expect(
      page.getByRole("heading", { name: "Add a Similar Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle Name", { exact: true })).toHaveValue(
      createdBottleName,
    );
    await expect(
      page.getByText(testBrand.name, { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("Age Statement")).toHaveValue(
      String(anotherReleaseSourceBottle.statedAge),
    );
    await expect(page.getByLabel("Edition or Batch")).toHaveValue(
      "First Fill Oloroso",
    );
    await expect(page.getByLabel("Release Year")).toHaveValue("2026");
    await expectNoHorizontalOverflow(page);

    const createRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/prices/matchQueue/createBottle"),
    );
    await page.getByRole("button", { name: "Add Bottle" }).click();
    const input = getRpcInput(await createRequestPromise);

    expect(Object.keys(input).sort()).toEqual([
      "independentBottle",
      "proposal",
    ]);
    expect(input.proposal).toBe(9901);
    const independentBottle = getRecord(input, "independentBottle");
    expect(independentBottle).toMatchObject({
      name: createdBottleName,
      brand: testBrand.id,
      statedAge: anotherReleaseSourceBottle.statedAge,
      edition: "First Fill Oloroso",
      releaseYear: 2026,
    });
    for (const legacyField of [
      "bottle",
      "release",
      "sourceBottle",
      "sourceBottleId",
      "group",
      "groupId",
    ]) {
      expect(input).not.toHaveProperty(legacyField);
      expect(independentBottle).not.toHaveProperty(legacyField);
    }
    await expect(page).toHaveURL(bottlePath(existingBottleId));
  });

  test("keeps exact age ownership behind the unified Bottle form", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "unified-edit"),
      user: { ...testUser, mod: true },
    });

    await page.goto(`/bottles/${existingBottleId}/edit`);

    await expect(
      page.getByRole("heading", { name: "Edit Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle Name", { exact: true })).toHaveValue(
      unifiedBottleEditContext.shared.name,
    );
    await expect(page.getByLabel("Age Statement")).toHaveValue(
      String(unifiedBottleEditContext.exact.statedAge),
    );
    await expect(page.getByLabel("Shared Stated Age")).toHaveCount(0);
    await expect(page.getByLabel("Bottle-specific Stated Age")).toHaveCount(0);
    await expect(page.getByLabel("Edition or Batch")).toHaveValue(
      unifiedBottleEditContext.exact.edition,
    );
    await expect(page.getByLabel("Alcohol (ABV)")).toHaveValue(
      String(unifiedBottleEditContext.exact.abv),
    );
    await expect(page.getByLabel("Distillation Year")).toHaveValue(
      String(unifiedBottleEditContext.exact.vintageYear),
    );
    await expect(page.getByLabel("Release Year")).toHaveValue(
      String(unifiedBottleEditContext.exact.releaseYear),
    );
    await expect(
      page.getByRole("group", { name: "Release family details" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Exact Bottle details" }),
    ).toHaveCount(0);
    await expect(page.getByText("Edit Bottling", { exact: true })).toHaveCount(
      0,
    );

    await page.getByLabel("Edition or Batch").fill("Cask 43");
    await expect(page.getByLabel("Edition or Batch")).toHaveValue("Cask 43");
    await page.getByLabel("Age Statement").fill("22");
    await expect(page.getByLabel("Age Statement")).toHaveValue("22");

    const updateRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/bottles/update"),
    );
    await page.getByRole("button", { name: "Save Changes" }).click();
    const updateInput = getRpcInput(await updateRequestPromise);
    expect(updateInput).toEqual({
      bottle: existingBottleId,
      edition: "Cask 43",
      statedAge: 22,
    });
    await expectNoHorizontalOverflow(page);
  });

  test("merges same-name Bottles with explicit retire and keep identities", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "exact-bottle-merge"),
      user: { ...testUser, mod: true },
    });

    await page.goto(`/bottles/${existingBottleId}/merge`);
    await expect(
      page.getByRole("heading", { name: "Merge Bottle" }),
    ).toBeVisible();

    await page.getByText("Other Bottle", { exact: true }).click();
    await page
      .getByRole("button", {
        name: `${exactMergeOtherBottle.fullName} · Bottle ${exactMergeOtherBottleId}`,
      })
      .click();

    const retireCurrent = `Retire “${exactMergeOtherBottle.fullName}” (Bottle ${existingBottleId}); keep “${exactMergeOtherBottle.fullName}” (Bottle ${exactMergeOtherBottleId})`;
    const retireOther = `Retire “${exactMergeOtherBottle.fullName}” (Bottle ${exactMergeOtherBottleId}); keep “${exactMergeOtherBottle.fullName}” (Bottle ${existingBottleId})`;
    await expect(
      page.getByRole("radio", { name: retireCurrent }),
    ).toBeChecked();
    await expect(page.getByRole("radio", { name: retireOther })).toBeVisible();

    const mergeRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/bottles/merge"),
    );
    await page.getByRole("button", { name: "Merge Bottles" }).click();
    expect(getRpcInput(await mergeRequestPromise)).toEqual({
      bottle: existingBottleId,
      other: exactMergeOtherBottleId,
      direction: "mergeInto",
    });
    await expect(page).toHaveURL(bottlePath(exactMergeOtherBottleId));
  });
});

function uniqueAccessToken(testInfo: TestInfo, suffix: string) {
  return [
    testAccessToken,
    suffix,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}

const mockApiServer =
  process.env.PLAYWRIGHT_API_SERVER ??
  `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? 4999}`;

function requireBaseURL(baseURL: string | undefined): string {
  if (!baseURL) {
    throw new Error("Expected Playwright to configure a base URL.");
  }
  return baseURL;
}

type RpcJsonValue =
  | string
  | number
  | boolean
  | null
  | RpcJsonValue[]
  | RpcJsonObject;

interface RpcJsonObject {
  [key: string]: RpcJsonValue;
}

function getRpcInput(request: Request): RpcJsonObject {
  const postData = request.postData();
  if (!postData) {
    throw new Error("Expected the RPC request to contain JSON input.");
  }

  const envelope: RpcJsonValue = JSON.parse(postData);
  if (!isRecord(envelope) || !isRecord(envelope.json)) {
    throw new Error("Expected the RPC request to use the JSON envelope.");
  }
  return envelope.json;
}

function getRecord(input: RpcJsonObject, field: string): RpcJsonObject {
  const value = input[field];
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object.`);
  }
  return value;
}

function isRecord(value: RpcJsonValue): value is RpcJsonObject {
  return z.record(z.string(), z.json()).safeParse(value).success;
}
