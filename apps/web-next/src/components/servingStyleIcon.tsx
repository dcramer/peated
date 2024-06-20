import { type ServingStyle } from "@peated/server/src/types";
import SvgServingNeat from "./assets/ServingNeat";
import SvgServingRocks from "./assets/ServingRocks";
import SvgServingSplash from "./assets/ServingSplash";

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
