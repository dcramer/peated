// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatTimestamp, Timestamp } from "./timestamp";

const date = "2026-07-21T00:30:00.000Z";
// SAFETY: React reads this documented test-only flag to verify updates happen inside act().
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("Timestamp", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
  });

  it("uses UTC for server output", () => {
    const html = renderToStaticMarkup(<Timestamp date={date} format="date" />);

    expect(html).toContain("Jul 21, 2026");
    expect(html).toContain(`dateTime="${date}"`);
  });

  it("uses the viewer's timezone in the browser", () => {
    const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      ...resolvedOptions,
      timeZone: "America/Los_Angeles",
    });
    root = createRoot(container);

    act(() => root?.render(<Timestamp date={date} format="dateTime" />));

    expect(container.textContent).toBe("Jul 20, 2026, 5:30 PM PDT");
    expect(container.querySelector("time")?.title).toContain("PDT");
  });

  it("keeps one instant accurate across timezones", () => {
    expect(formatTimestamp(date, "date", "UTC")).toBe("Jul 21, 2026");
    expect(formatTimestamp(date, "date", "America/Los_Angeles")).toBe(
      "Jul 20, 2026",
    );
  });
});
