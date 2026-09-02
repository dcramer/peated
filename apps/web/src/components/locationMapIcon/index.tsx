import type { ComponentPropsWithoutRef } from "react";

import type { LocationMap } from "../../lib/locationMap";
import CountryMapIcon from "../countryMapIcon";
import UsStateMapIcon from "../usStateMapIcon";
import CampbeltownMap from "./assets/campbeltown.svg";
import HighlandMap from "./assets/highland.svg";
import IslandsMap from "./assets/islands.svg";
import IslayMap from "./assets/islay.svg";
import LowlandMap from "./assets/lowland.svg";
import SpeysideMap from "./assets/speyside.svg";

const regionMaps = {
  "scotland/islay": IslayMap,
  "scotland/highland": HighlandMap,
  "scotland/speyside": SpeysideMap,
  "scotland/lowland": LowlandMap,
  "scotland/campbeltown": CampbeltownMap,
  "scotland/islands": IslandsMap,
};

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
    case "region": {
      const MapIcon = regionMaps[visual.slug];
      return <MapIcon {...props} />;
    }
  }
}
