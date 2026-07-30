import { expect, type Request, test, type TestInfo } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  anotherReleaseSourceBottle,
  createdBottleId,
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
  test("applies a direct Bottle queue draft as one independent Bottle", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "queue-direct-bottle"),
      user: { ...testUser, admin: true, mod: true },
    });

    await page.goto("/admin/queue");

    await expect(
      page.getByRole("heading", { name: "Incoming Listings" }),
    ).toBeVisible();
    await expect(page.getByText("Bottle Draft", { exact: true })).toHaveCount(
      1,
    );
    await expect(page.getByText("Bottling Draft", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText("16 years", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply Bottle Draft" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Apply Bottling Draft/ }),
    ).toHaveCount(0);

    const createRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/prices/matchQueue/createBottle"),
    );
    await page.getByRole("button", { name: "Apply Bottle Draft" }).click();
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
    expect(independentBottle.caskType).toBe("oloroso");
    expect(independentBottle.caskFill).toBe("1st_fill");
    expect(independentBottle.caskSize).toBe("hogshead");
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

    const createdFullName = `${anotherReleaseSourceBottle.brand.name} ${anotherReleaseSourceBottle.name} Cask 17`;
    await expect(
      page.getByRole("link", { name: createdFullName }),
    ).toHaveAttribute("href", `/bottles/${createdBottleId}`);
    await expect(
      page.getByText("No actionable queue items match", { exact: false }),
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
    await expect(page).toHaveURL(new RegExp(`${returnTo}$`));
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
    const preview = page.getByRole("region", { name: "Bottle preview" });
    await expect(preview).toContainText(
      `${unifiedBottleEditContext.exact.statedAge} years`,
    );
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
    await expect(preview).toContainText("Cask 42");
    await expect(preview).toContainText("55.1% ABV");
    await expect(preview).toContainText("2023 release");
    await expect(preview).toContainText("2004 vintage");
    await expect(page.getByText("Edit Bottling", { exact: true })).toHaveCount(
      0,
    );

    await page.getByLabel("Edition or Batch").fill("Cask 43");
    await expect(preview).toContainText("Cask 43");
    await expect(preview).not.toContainText("Cask 42");
    await page.getByLabel("Age Statement").fill("22");
    await expect(preview).toContainText("22 years");

    const updateRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/bottles/update"),
    );
    await page.getByRole("button", { name: "Save Changes" }).click();
    const updateInput = getRpcInput(await updateRequestPromise);
    expect(updateInput).toEqual({
      bottle: existingBottleId,
      exact: { edition: "Cask 43", statedAge: 22 },
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
    await expect(page).toHaveURL(
      new RegExp(`/bottles/${exactMergeOtherBottleId}$`),
    );
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

function requireBaseURL(baseURL: string | undefined): string {
  if (!baseURL) {
    throw new Error("Expected Playwright to configure a base URL.");
  }
  return baseURL;
}

function getRpcInput(request: Request): Record<string, unknown> {
  const postData = request.postData();
  if (!postData) {
    throw new Error("Expected the RPC request to contain JSON input.");
  }

  const envelope: unknown = JSON.parse(postData);
  if (!isRecord(envelope) || !isRecord(envelope.json)) {
    throw new Error("Expected the RPC request to use the JSON envelope.");
  }
  return envelope.json;
}

function getRecord(
  input: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const value = input[field];
  if (!isRecord(value)) {
    throw new Error(`Expected ${field} to be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
