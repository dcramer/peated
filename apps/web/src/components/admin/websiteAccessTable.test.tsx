import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import WebsiteAccessTable from "./websiteAccessTable";

const noop = () => {};

describe("WebsiteAccessTable", () => {
  test("offers only the actions that apply to each website", () => {
    const html = renderToStaticMarkup(
      <WebsiteAccessTable
        sites={[
          {
            origin: "https://walled.example",
            blockedAt: "2026-10-30T12:00:00.000Z",
            robotsException: null,
          },
          {
            origin: "https://allowed.example",
            blockedAt: null,
            robotsException: {
              reason: "Owner allowed PeatedBot by email.",
              createdAt: "2026-10-30T12:00:00.000Z",
              createdBy: { id: 1, username: "dcramer" },
            },
          },
        ]}
        pendingOrigin={null}
        onClearBlock={noop}
        onRemoveException={noop}
      />,
    );
    const [walled, allowed] = html
      .split("<tr")
      .filter((row) => row.includes(".example"));

    expect(walled).toContain("Clear block");
    expect(walled).not.toContain("Remove exception");
    expect(allowed).toContain("Remove exception");
    expect(allowed).not.toContain("Clear block");
    expect(allowed).toContain("Owner allowed PeatedBot by email. · @dcramer");
  });
});
