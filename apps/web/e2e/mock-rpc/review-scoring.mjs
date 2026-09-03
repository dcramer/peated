import {
  activityReview,
  existingBottleDetails,
  priceSite,
} from "../rpc-fixtures.mjs";

export function createReviewScoringMock() {
  const settingsByToken = new Map();
  return ({ path, input, token }) => {
    if (!token.includes("review-scoring")) return null;
    const settings = settingsByToken.get(token) ?? {
      version: 0,
      policy: null,
      recomputePending: false,
    };
    const result = (value) => ({ type: "response", value });
    switch (path) {
      case "externalSites/scrapeSources/list":
        return result([]);
      case "externalSites/reviewScoring/get":
        return result(settings);
      case "externalSites/reviewScoring/preview": {
        const enabled = input.policy.enabled;
        return result({
          version: settings.version,
          totalBottles: 1,
          samples: [
            {
              id: 1,
              name: "Example whisky review",
              url: "https://example.com/review",
              nativeScore: { value: 3.5, scale: 5, display: "3.5/5" },
              before: {
                value: settings.policy?.enabled ? 86 : null,
                reason: settings.policy?.enabled ? "counted" : "not_configured",
                guideUrl: null,
              },
              after: {
                value: enabled ? 86 : null,
                reason: enabled ? "counted" : "excluded",
                guideUrl: null,
              },
              contribution: {
                value: enabled ? 86 : null,
                reason: enabled ? "counted" : "excluded",
                guideUrl: null,
              },
            },
          ],
          bottles: [
            {
              bottle: existingBottleDetails,
              before: {
                median: settings.policy?.enabled ? 86 : 91,
                count: settings.policy?.enabled ? 2 : 1,
              },
              after: { median: enabled ? 86 : 91, count: enabled ? 2 : 1 },
            },
          ],
        });
      }
      case "externalSites/reviewScoring/update": {
        if (
          input.expectedVersion !== settings.version ||
          input.policy.rules[0]?.scale !== 5 ||
          input.policy.rules[0]?.points[0]?.target !== 82 ||
          input.policy.rules[0]?.points[1]?.target !== 90
        )
          return { type: "error", message: "Unexpected score settings" };
        const saved = {
          version: settings.version + 1,
          policy: input.policy,
          recomputePending: false,
        };
        settingsByToken.set(token, saved);
        return result(saved);
      }
      case "externalReviews/list":
        return result({
          results: [
            {
              ...activityReview,
              site: priceSite,
              bottle: existingBottleDetails,
              nativeScore: { value: 3.5, scale: 5, display: "3.5/5" },
              scoreContribution: {
                value: settings.policy?.enabled ? 86 : null,
                reason: settings.policy?.enabled ? "counted" : "excluded",
                guideUrl: "https://example.com/scoring",
              },
            },
          ],
          rel: { nextCursor: null, prevCursor: null },
        });
      default:
        return null;
    }
  };
}
