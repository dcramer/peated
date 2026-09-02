import type { ComponentPropsWithoutRef } from "react";

import type { LocationMap } from "../../lib/locationMap";
import CountryMapIcon from "../countryMapIcon";
import UsStateMapIcon from "../usStateMapIcon";
import IslayMap from "./assets/islay.svg";

/** Renders the selected country's or region's own outline. */
export function LocationMapIcon({
  visual,
  ...props
}: ComponentPropsWithoutRef<"svg"> & { visual: LocationMap }) {
  switch (visual.kind) {
    case "country":
      return <CountryMapIcon slug={visual.slug} {...props} />;
    case "state":
      return <UsStateMapIcon slug={visual.slug} {...props} />;
    case "region":
      return <IslayMap {...props} />;
  }
}
