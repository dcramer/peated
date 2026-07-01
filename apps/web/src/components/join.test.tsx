import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Join from "./join";

describe("Join", () => {
  it("keeps punctuation joins inside a single inline flex item", () => {
    const links = [<a key="x">X</a>, <a key="y">Y</a>];

    const html = renderToStaticMarkup(
      <div className="flex gap-x-1">
        <Join divider=", ">{links}</Join>
      </div>,
    );

    expect(html).toBe(
      '<div class="flex gap-x-1"><span><a>X</a>, <a>Y</a></span></div>',
    );
  });
});
