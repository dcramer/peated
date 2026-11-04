import {
  experimental_decide as decide,
  Experimental_DecisionRefusalError,
  type Experimental_DecisionModel,
} from "ai";

const SCOPE_CHOICES = {
  one_whisky_bottle:
    "One bottle of whisky on its own. Its own box, tin, case, or decanter still counts. An old bottling, a large bottle, a cask finish named after another drink, and an unclear or unknown release all still count.",
  other_spirit:
    "A drink that is not whisky: gin, rum, cognac, armagnac, brandy, calvados, vodka, tequila, champagne, wine, port, vermouth, absinthe, or new-make spirit that is not yet whisky.",
  flavored_or_liqueur:
    "A flavored whisky, a whisky liqueur, or whisky with added flavoring.",
  several_items:
    "More than one item together: a set, multipack, gift or tasting pack, or a bottle with glasses, minis, a jug, or other items.",
  miniature: "A miniature bottle of 10 cl (100 ml) or less.",
  sample:
    "A sample instead of a marketed bottle: a cask sample, trade or duty-paid sample, or sample vial.",
  hand_fill:
    "A distillery hand-fill: a bottle filled by hand from a cask at the distillery for a visitor.",
  not_a_drink:
    "Not a drink at all: glassware, a jug, a display or plinth, a print, book, clothing, or other merchandise.",
};

type ScopeChoice = keyof typeof SCOPE_CHOICES;

// The pre-check may only ignore, so a cutoff must stay clear of every real
// whisky Bottle. Across 12,042 auction lots, store listings, and reviews
// (C46, 2026-11-03), no in-scope title came within 0.2 of these cutoffs, and
// answers vary by about 0.05 between runs. Other answers never ignore here:
// whisky finished in port casks reached 0.99 as another drink, a
// single blended malt named "Duo" scored as a set, and a bottle with an anime
// label scored as merchandise. The agent decides those. Owner: Bottle
// classifier.
const IGNORE_ANSWERS = new Map<
  ScopeChoice,
  { cutoff: number; description: string }
>([
  ["hand_fill", { cutoff: 0.7, description: "a distillery hand-fill" }],
  ["sample", { cutoff: 0.7, description: "a sample" }],
  ["miniature", { cutoff: 0.7, description: "a miniature" }],
  [
    "flavored_or_liqueur",
    { cutoff: 0.9, description: "a flavored whisky or whisky liqueur" },
  ],
]);

/**
 * Asks a decision model what the source sells, from its title alone, and
 * returns an ignore reason only for a clearly out-of-scope answer. Any other
 * answer returns null so the classifier agent decides scope.
 */
export async function getScopePrecheckIgnoreReason({
  model,
  title,
}: {
  model: Experimental_DecisionModel;
  title: string;
}): Promise<string | null> {
  try {
    const { answers } = await decide({
      model,
      state: { title },
      questions: {
        scope: {
          type: "choice",
          instructions:
            "What product does this source sell or describe? It may be a store listing, an auction lot, or a review. Judge what the product is, not how well the title identifies it.",
          criteria: SCOPE_CHOICES,
        },
      },
      telemetry: { functionId: "bottle_scope_precheck" },
    });
    const { choice, probabilities } = answers.scope;
    const ignore = IGNORE_ANSWERS.get(choice);
    const probability = probabilities?.[choice] ?? 0;
    if (!ignore || probability < ignore.cutoff) return null;

    return `The scope pre-check found ${ignore.description}, not one whisky Bottle (confidence ${probability.toFixed(2)}).`;
  } catch (error) {
    // A refusal is an answer, not an outage: the agent decides scope instead.
    if (Experimental_DecisionRefusalError.isInstance(error)) return null;
    throw error;
  }
}
