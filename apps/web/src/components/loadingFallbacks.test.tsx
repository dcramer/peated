import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DefaultLoading from "./defaultLoading";
import RightSidebarSkeleton from "./rightSidebarSkeleton";
import Spinner from "./spinner";

function countOccurrences(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

describe("loading fallbacks", () => {
  it("renders the default spinner in a stable reserved block", () => {
    const html = renderToStaticMarkup(createElement(DefaultLoading));

    expect(html).toContain("min-h-96");
    expect(html).toContain("pt-16");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="h-32 max-h-full w-32 max-w-full"');
  });

  it("renders the spinner without client-only measurement or hidden first paint", () => {
    const html = renderToStaticMarkup(createElement(Spinner));

    expect(html).toContain('pathLength="100"');
    expect(html).toContain("stroke-dasharray:10");
    expect(html).toContain("stroke-dashoffset:100");
    expect(html).toContain("animation:dash 10s linear infinite");
    expect(html).not.toContain("svg-animate");
    expect(html).not.toContain(" hidden ");
  });

  it("renders the right sidebar fallback as decorative reserved structure", () => {
    const html = renderToStaticMarkup(createElement(RightSidebarSkeleton));

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-highlight h-10");
    expect(countOccurrences(html, "h-8 animate-pulse")).toBe(12);
    expect(html).not.toContain('role="status"');
  });
});
