import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  ExternalSiteIcon,
  ExternalSiteIdentity,
} from "./externalSiteIcon.stylex";

describe("ExternalSiteIcon", () => {
  test("renders a stored site icon", () => {
    const html = renderToStaticMarkup(
      <ExternalSiteIcon
        imageUrl="https://api.peated.com/uploads/external-sites/example.webp"
        name="Example"
      />,
    );

    expect(html).toContain("example.webp");
    expect(html).toContain('alt=""');
  });

  test("uses the site initial when no icon is stored", () => {
    const html = renderToStaticMarkup(
      <ExternalSiteIdentity imageUrl={null} name="Whisky Notes" size="sm" />,
    );

    expect(html).toContain(">W</span>");
    expect(html).toContain("Whisky Notes");
  });
});
