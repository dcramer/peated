import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CarouselControls from "./carouselControls";

describe("CarouselControls", () => {
  it("renders one fixed-width control set", () => {
    const html = renderToStaticMarkup(
      <CarouselControls
        currentIndex={0}
        total={10}
        previousLabel="Previous tasting"
        nextLabel="Next tasting"
        previousDisabled
        onPrevious={() => undefined}
        onNext={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Carousel controls"');
    expect(html).toContain('aria-label="Previous tasting"');
    expect(html).toContain('aria-label="Next tasting"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("h-8 w-12");
    expect(html).toContain("1 / 10");
  });

  it("does not render controls for one slide", () => {
    expect(
      renderToStaticMarkup(
        <CarouselControls
          currentIndex={0}
          total={1}
          previousLabel="Previous"
          nextLabel="Next"
          onPrevious={() => undefined}
          onNext={() => undefined}
        />,
      ),
    ).toBe("");
  });
});
