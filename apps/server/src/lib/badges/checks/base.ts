import type { SQL } from "drizzle-orm";
import type { TastingWithRelations, TrackedObject } from "../types";

export type CheckConfigSchema = Record<string, any>;

export abstract class Check {
  schema: null | CheckConfigSchema = null;

  abstract buildWhereClause(config: CheckConfigSchema): SQL[];

  abstract test(
    config: CheckConfigSchema,
    tasting: TastingWithRelations,
  ): boolean;

  async parseConfig(config: unknown) {
    return this.schema ? this.schema.parse(config) : {};
  }
}
