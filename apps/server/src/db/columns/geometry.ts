import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";
import wkx from "wkx";

type LatLng = [number, number];

type GeometryPointType = Point | LatLng | string;

type GeometryPointGeoJson = {
  type: "Point";
  coordinates: {
    lat: number;
    lng: number;
  };
};

export class Point {
  lat: number;
  lng: number;

  constructor(lat: number, lng: number) {
    this.lat = lat;
    this.lng = lng;
  }

  mapToDriverValue() {
    return sql`ST_SetSRID(ST_MakePoint(${this.lat}, ${this.lng}), 4326)`;
  }
}

// export function geography<TData extends GeographyType = string>(name: string) {
//   return customType<{ data: TData; driverData: string }>({
//     dataType() {
//       return "geography";
//     },

//     toDriver(value: TData) {
//       if (typeof value === "string") return value;
//       if (Array.isArray(value))
//         return sql`ST_SetSRID(ST_MakePoint(${value[0]}, ${value[1]}), 4326)`;
//       return value.mapToDriverValue();
//     },
//   })(name);
// }

export function geometry_point(name: string) {
  return customType<{ data: LatLng; driverData: string }>({
    // this should be sql``
    dataType() {
      return "geometry(Point, 4326)";
    },

    fromDriver(value: string | GeometryPointGeoJson): LatLng {
      if (typeof value === "string") {
        const parsed = wkx.Geometry.parse(
          Buffer.from(value, "hex")
        ) as unknown as {
          x: number;
          y: number;
        };
        return [parsed.x, parsed.y];
      }

      return [value.coordinates.lat, value.coordinates.lng];
    },

    toDriver(value: GeometryPointType) {
      if (typeof value === "string") return value;
      if (Array.isArray(value))
        return sql`ST_SetSRID(ST_MakePoint(${value[0]}, ${value[1]}), 4326)`;
      return value.mapToDriverValue();
    },
  })(name);
}
