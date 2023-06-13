import type { ColumnBuilderConfig, ColumnConfig } from "drizzle-orm";
import type {
  AnyPgTable,
  PgColumnBuilderHKT,
  PgColumnHKT,
} from "drizzle-orm/pg-core";
import { PgColumn, PgColumnBuilder } from "drizzle-orm/pg-core";

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

// SRID=4326;POINT(longitude latitude)

export class PgGeographyBuilder<
  TData extends GeographyType = string,
> extends PgColumnBuilder<
  PgColumnBuilderHKT,
  ColumnBuilderConfig<{ data: TData; driverParam: string }>
> {
  protected $pgColumnBuilderBrand = "PgGeographyBuilder";

  build<TTableName extends string>(
    table: AnyPgTable<{ name: TTableName }>,
  ): PgGeography<TTableName, TData> {
    return new PgGeography(table, this.config);
  }
}

export class PgGeography<
  TTableName extends string,
  TData extends GeographyType,
> extends PgColumn<
  PgColumnHKT,
  ColumnConfig<{ tableName: TTableName; data: TData; driverParam: string }>
> {
  constructor(
    table: AnyPgTable<{ name: TTableName }>,
    builder: PgGeographyBuilder<TData>["config"],
  ) {
    super(table, builder);
  }

  getSQLType(): string {
    return "geography";
  }

  override mapToDriverValue(value: TData | GeographyType): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return `SRID=4326;POINT(${value[0]} ${value[1]})`;
    return value.mapToDriverValue();
  }
}

export function geography<T extends GeographyType = string>(
  name: string,
): PgGeographyBuilder<T> {
  return new PgGeographyBuilder(name);
}
