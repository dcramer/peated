import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";
import wkx from "wkx";
import { z } from "zod";

type LatLng = [number, number];

type GeometryPointType = Point | LatLng | string;

type GeometryPointGeoJson = {
  type: "Point";
  coordinates: LatLng;
};

type GeometryPointJsonValue = {
  type?: string;
  coordinates?: number[] | { lat?: number; lng?: number };
};

const CoordinatesSchema = z.tuple([z.number(), z.number()]);
const GeometryPointGeoJsonSchema = z
  .object({
    type: z.literal("Point"),
    coordinates: CoordinatesSchema,
  })
  .strict();

export function parseGeometryPoint(
  value: string | GeometryPointJsonValue,
): LatLng {
  const encodedGeometry = z.string().safeParse(value);
  if (encodedGeometry.success) {
    const parsed = wkx.Geometry.parse(Buffer.from(encodedGeometry.data, "hex"));
    if (!(parsed instanceof wkx.Point)) {
      throw new TypeError("Expected point geometry from database.");
    }
    return CoordinatesSchema.parse([parsed.x, parsed.y]);
  }

  return GeometryPointGeoJsonSchema.parse(value).coordinates;
}

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
      return parseGeometryPoint(value);
    },

    toDriver(value: GeometryPointType) {
      const encodedGeometry = z.string().safeParse(value);
      if (encodedGeometry.success) return encodedGeometry.data;
      if (Array.isArray(value))
        return sql`ST_SetSRID(ST_MakePoint(${value[0]}, ${value[1]}), 4326)`;
      return z.instanceof(Point).parse(value).mapToDriverValue();
    },
  })(name);
}
