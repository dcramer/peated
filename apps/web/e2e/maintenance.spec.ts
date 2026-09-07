import { expect, test } from "./test";

import { adminUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("runs the catalog summary rebuild", async ({
  context,
  page,
  snapshot,
}) => {
  await signIn(context, {
    user: adminUser,
  });

  await page.goto("/admin/maintenance");

  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toBeVisible();
  await snapshot("admin/maintenance", {
    ready: page.getByRole("button", { name: "Rebuild catalog summaries" }),
  });

  const catalogSummaryRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/admin/rebuildCatalogSummaries"),
  );
  await page.getByRole("button", { name: "Rebuild catalog summaries" }).click();
  await catalogSummaryRequest;
  await expect(
    page.getByText("Catalog summary rebuild started."),
  ).toBeVisible();
});

test("@mobile shows Maintenance", async ({ context, page, snapshot }) => {
  await signIn(context, {
    user: adminUser,
  });

  await page.goto("/admin/maintenance");

  await snapshot("admin/maintenance-mobile", {
    ready: page.getByRole("button", { name: "Rebuild catalog summaries" }),
  });
});
