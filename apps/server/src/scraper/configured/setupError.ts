import type { ScrapeIssue } from "./preview";

export type ScrapeSourceSetupFeedback = {
  message: string;
  issues: ScrapeIssue[];
};

/** Expected page-rule failures are repair input, not system failures. */
export class ScrapeSourceSetupError extends Error {
  override name = "ScrapeSourceSetupError";

  constructor(
    readonly summary: string,
    readonly issues: ScrapeIssue[] = [],
  ) {
    const details = issues
      .slice(0, 3)
      .map((issue) => `${issue.field}: ${issue.message}`)
      .join(" ");
    super(details ? `${summary} ${details}` : summary);
  }

  feedback(): ScrapeSourceSetupFeedback {
    return { message: this.summary, issues: this.issues };
  }
}
