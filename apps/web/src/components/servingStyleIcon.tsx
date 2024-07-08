import { type ServingStyle } from "@peated/server/src/types";
import SvgServingNeat from "@peated/web/assets/serving-neat.svg";
import SvgServingRocks from "@peated/web/assets/serving-rocks.svg";
import SvgServingSplash from "@peated/web/assets/serving-splash.svg";

export default function ServingStyleIcon({
  servingStyle,
  size = 6,
  className = "",
}: {
  servingStyle: ServingStyle;
  size?: number;
  className?: string;
}) {
  let Component;
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
  return <Component className={`h-${size} w-${size} ${className}`} />;
}
