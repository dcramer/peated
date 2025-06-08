import type { ServingStyle } from "@peated/server/types";
import SvgServingNeat from "@peated/web/assets/serving-neat.svg?react";
import SvgServingRocks from "@peated/web/assets/serving-rocks.svg?react";
import SvgServingSplash from "@peated/web/assets/serving-splash.svg?react";

export default function ServingStyleIcon({
  servingStyle,
  size = 6,
  className = "",
}: {
  servingStyle: ServingStyle;
  size?: number;
  className?: string;
}) {
  let Component: any = null;
  switch (servingStyle) {
    case "neat":
      Component = SvgServingNeat;
      break;
    case "rocks":
      Component = SvgServingRocks;
      break;
    case "splash":
      Component = SvgServingSplash;
      break;
    default:
      return null;
  }
  return <Component className={`h-${size}w-${size} ${className}`} />;
}
