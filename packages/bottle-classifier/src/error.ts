import {
  buildBottleClassificationArtifacts,
  type BottleClassificationArtifacts,
} from "./contract";

export class BottleClassificationError extends Error {
  readonly artifacts: BottleClassificationArtifacts;

  constructor(
    message: string,
    artifacts: Partial<BottleClassificationArtifacts>,
    options?: {
      cause?: unknown;
    },
  ) {
    super(message, options);
    this.name = "BottleClassificationError";
    this.artifacts = buildBottleClassificationArtifacts(artifacts);
  }
}
