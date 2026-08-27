import type { Point } from "@peated/server/types";
import type { LatLngTuple } from "leaflet";

export function toLeafletLatLng([longitude, latitude]: Point): LatLngTuple {
  return [latitude, longitude];
}
