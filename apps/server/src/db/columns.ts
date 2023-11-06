import { customType } from "drizzle-orm/pg-core";

export class Point {
  lat: number;
  lng: number;

  constructor(lat: number, lng: number) {
    this.lat = lat;
    this.lng = lng;
  }

  mapToDriverValue() {
    return `SRID=4326;POINT(${this.lat} ${this.lng})`;
  }
}

type GeographyType = Point | [number, number] | string;

export function geography<TData extends GeographyType = string>(name: string) {
  return customType<{ data: TData; driverData: string }>({
    dataType() {
      return "geography";
    },

    toDriver(value: TData): string {
      if (typeof value === "string") return value;
      if (Array.isArray(value))
        return `SRID=4326;POINT(${value[0]} ${value[1]})`;
      return value.mapToDriverValue();
    },
  })(name);
}
