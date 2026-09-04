import { expect, test } from "./test";

import { adminUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("runs the Bottle count repair", async ({ context, page, snapshot }) => {
  await signIn(context, {
    user: adminUser,
  });

  await page.goto("/admin/maintenance");

  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toBeVisible();
  await snapshot("admin/maintenance", {
    ready: page.getByRole("button", { name: "Check Bottle counts" }),
  });

  const bottleCountRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/admin/repairBottleCounts"),
  );
  await page.getByRole("button", { name: "Check Bottle counts" }).click();
  await bottleCountRequest;
  await expect(page.getByText("Bottle count check started.")).toBeVisible();
});

test("@mobile shows Maintenance", async ({ context, page, snapshot }) => {
  await signIn(context, {
    user: adminUser,
  });

  await page.goto("/admin/maintenance");

  await snapshot("admin/maintenance-mobile", {
    ready: page.getByRole("button", { name: "Check Bottle counts" }),
  });
});
