import { expect, type Page } from "@playwright/test";

export function bottlePeatedIdPath(id: number) {
  return `/B${String(id).padStart(4, "0")}`;
}

/** Asserts that the rendered page does not create horizontal overflow. */
export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      { message: "page should not create horizontal overflow" },
    )
    .toBeLessThanOrEqual(1);
}
