import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, IconButton } from "./button.stylex";

describe("button controls", () => {
  it("uses the same native behavior for label and icon buttons", () => {
    const labelButton = renderToStaticMarkup(
      <Button loading size="lg" type="submit" variant="accent">
        Save
      </Button>,
    );
    const iconButton = renderToStaticMarkup(
      <IconButton
        icon={<span aria-hidden>+</span>}
        label="Add"
        loading
        size="lg"
        type="submit"
        variant="accent"
      />,
    );

    for (const html of [labelButton, iconButton]) {
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('data-size="lg"');
      expect(html).toContain('data-variant="accent"');
      expect(html).toContain("disabled");
      expect(html).toContain('type="submit"');
    }
  });
});
