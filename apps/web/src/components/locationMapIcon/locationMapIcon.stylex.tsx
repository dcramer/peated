import type { CompiledStyles } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";

import { getLocationMapUrl, type LocationMap } from "../../lib/locationMap";

/**
 * Renders the selected country's or region's own outline in the current text
 * color. Renders nothing when Peated has no artwork for the location.
 */
export function LocationMapIcon({
  visual,
  style,
}: {
  visual: LocationMap;
  style?: CompiledStyles;
}) {
  const url = getLocationMapUrl(visual);
  if (!url) return null;

  // The artwork is a static file, so a page loads only the outlines it shows.
  return (
    <span
      aria-hidden="true"
      {...stylex.props(styles.icon, styles.mask(`url("${url}")`), style)}
    />
  );
}

const styles = stylex.create({
  icon: {
    display: "block",
    backgroundColor: "currentColor",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  },
  mask: (image: string) => ({
    maskImage: image,
    WebkitMaskImage: image,
  }),
});
