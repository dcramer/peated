import { z } from "zod";

export const CatalogMigrationDatabaseIdentitySchema = z
  .object({
    databaseName: z.string().min(1),
    systemIdentifier: z.string().regex(/^\d+$/),
    isInRecovery: z.literal(false),
  })
  .strict();

export const CatalogMigrationDatabaseConnectionSchema = z
  .object({
    serverAddress: z.string().min(1).nullable(),
    serverPort: z.number().int().positive().max(65_535).nullable(),
    currentUser: z.string().min(1),
  })
  .strict();

export const CatalogMigrationDatabaseEvidenceSchema = z
  .object({
    identity: CatalogMigrationDatabaseIdentitySchema,
    connection: CatalogMigrationDatabaseConnectionSchema,
  })
  .strict();

export type CatalogMigrationDatabaseIdentity = z.infer<
  typeof CatalogMigrationDatabaseIdentitySchema
>;
export type CatalogMigrationDatabaseEvidence = z.infer<
  typeof CatalogMigrationDatabaseEvidenceSchema
>;

export function sameCatalogMigrationDatabaseIdentity(
  left: CatalogMigrationDatabaseIdentity,
  right: CatalogMigrationDatabaseIdentity,
): boolean {
  return (
    left.databaseName === right.databaseName &&
    left.systemIdentifier === right.systemIdentifier &&
    left.isInRecovery === right.isInRecovery
  );
}

export function sameCatalogMigrationDatabaseEvidence(
  left: CatalogMigrationDatabaseEvidence,
  right: CatalogMigrationDatabaseEvidence,
): boolean {
  return (
    sameCatalogMigrationDatabaseIdentity(left.identity, right.identity) &&
    left.connection.serverAddress === right.connection.serverAddress &&
    left.connection.serverPort === right.connection.serverPort &&
    left.connection.currentUser === right.connection.currentUser
  );
}
