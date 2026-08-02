import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PageHeader from "./pageHeader";

describe("PageHeader", () => {
  it("allows title extras such as tooltips to overflow the title wrapper", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Bottle name" titleExtra={<span>Tooltip</span>} />,
    );

    expect(html).toContain(
      'class="flex min-w-0 flex-auto flex-col items-center justify-center lg:w-auto lg:items-start"',
    );
    expect(html).toContain(
      'class="max-w-full truncate text-center font-semibold lg:mx-0 lg:text-left text-2xl"',
    );
  });
});
