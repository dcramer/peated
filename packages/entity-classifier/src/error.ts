import type { EntityClassificationArtifacts } from "./contract";

export class EntityClassificationError extends Error {
  readonly artifacts: EntityClassificationArtifacts;

  constructor(
    message: string,
    artifacts: EntityClassificationArtifacts,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EntityClassificationError";
    this.artifacts = artifacts;
  }
}
