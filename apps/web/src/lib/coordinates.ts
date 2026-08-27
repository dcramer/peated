import type { Point } from "@peated/server/types";
import type { LatLngTuple } from "leaflet";

/**
 * Leaflet is the coordinate-order exception: it expects [latitude, longitude].
 * Keep API and stored points in GeoJSON/PostGIS [longitude, latitude] order.
 */
export function toLeafletLatLng([longitude, latitude]: Point): LatLngTuple {
  return [latitude, longitude];
}
