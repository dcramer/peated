import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import AdvancedRatingDisplay from "./advancedRatingDisplay";
import AdvancedRatingInput from "./advancedRatingInput";
import RatingSystemPicker from "./ratingSystemPicker";

describe("advanced rating components", () => {
  test("displays an individual score with its Peated band", () => {
    const html = renderToStaticMarkup(<AdvancedRatingDisplay score={92} />);

    expect(html).toContain("92 points");
    expect(html).toContain("Exceptional");
  });

  test("displays an aggregate with one decimal and count", () => {
    const html = renderToStaticMarkup(
      <AdvancedRatingDisplay score={86} aggregate count={2} />,
    );

    expect(html).toContain("86.0 points");
    expect(html).toContain("2 scores");
  });

  test("renders input constraints, guidance, and methodology link", () => {
    const html = renderToStaticMarkup(
      <AdvancedRatingInput value={85} onChange={() => undefined} />,
    );

    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain("Very good");
    expect(html).toContain('href="/ratings"');
  });

  test("marks the selected rating system", () => {
    const html = renderToStaticMarkup(
      <RatingSystemPicker value="advanced" onChange={() => undefined} />,
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("100-point");
  });
});
