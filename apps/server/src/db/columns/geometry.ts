import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";
import wkx from "wkx";
import { z } from "zod";

type Coordinates = [longitude: number, latitude: number];

type GeometryPointType = Coordinates | Point | string;

type GeometryPointGeoJson = {
  type: "Point";
  coordinates: Coordinates;
};

type GeometryPointJsonValue = {
  type?: string;
  coordinates?: number[] | { lat?: number; lng?: number };
  crs?: unknown;
};

const CoordinatesSchema = z.tuple([z.number(), z.number()]);
const GeometryPointGeoJsonSchema = z.object({
  type: z.literal("Point"),
  coordinates: CoordinatesSchema,
});

export function parseGeometryPoint(
  value: string | GeometryPointJsonValue,
): Coordinates {
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
  longitude: number;
  latitude: number;

  constructor(longitude: number, latitude: number) {
    this.longitude = longitude;
    this.latitude = latitude;
  }

  mapToDriverValue() {
    return sql`ST_SetSRID(ST_MakePoint(${this.longitude}, ${this.latitude}), 4326)`;
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
  return customType<{ data: Coordinates; driverData: string }>({
    // this should be sql``
    dataType() {
      return "geometry(Point, 4326)";
    },

    fromDriver(value: string | GeometryPointGeoJson): Coordinates {
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
