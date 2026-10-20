/**
 * Tasting draft routes for the browser tests. Only access tokens that include
 * "tasting-draft" start with a draft, so other tests see no drafts.
 */
export function createTastingDraftMock({ buildTasting, buildTastingDraft }) {
  const draftsByToken = new Map();

  function response(value) {
    return { type: "response", value };
  }

  function error(message) {
    return { type: "error", message };
  }

  function notFound() {
    return { type: "notFound", message: "Draft not found." };
  }

  function getDrafts(token) {
    let drafts = draftsByToken.get(token);
    if (!drafts) {
      drafts = new Map();
      if (token.includes("tasting-draft")) {
        const draft = buildTastingDraft();
        drafts.set(draft.id, draft);
      }
      draftsByToken.set(token, drafts);
    }
    return drafts;
  }

  function handleRpcRequest({ path, input, token, getBottle }) {
    if (!path.startsWith("tastingDrafts/")) return null;
    const drafts = getDrafts(token);

    switch (path) {
      case "tastingDrafts/count":
        return response({ count: drafts.size });
      case "tastingDrafts/list":
        return response({
          results: [...drafts.values()],
          rel: { nextCursor: null, prevCursor: null },
        });
      case "tastingDrafts/details": {
        const draft = drafts.get(input?.draft);
        return draft ? response(draft) : notFound();
      }
      case "tastingDrafts/upsert": {
        const draft = drafts.get(input?.draft);
        if (!draft) return error("Unexpected tasting draft save");
        // Saves replace the whole draft, so the client must send it all back.
        if (
          input.tastedAt !== draft.tastedAt ||
          input.bottleHint !== draft.bottleHint ||
          input.pendingImageId !== undefined
        ) {
          return error("Tasting draft save dropped existing fields");
        }
        const saved = {
          ...draft,
          bottle: input.bottle === null ? null : getBottle(input.bottle),
          notes: input.notes ?? null,
          ratingBand: input.ratingBand ?? null,
          tags: input.tags ?? [],
          servingStyle: input.servingStyle ?? null,
          color: input.color ?? null,
          friends: [],
        };
        drafts.set(saved.id, saved);
        return response(saved);
      }
      case "tastingDrafts/publish": {
        const draft = drafts.get(input?.draft);
        if (!draft) return notFound();
        if (!draft.bottle || !draft.ratingBand || !draft.notes) {
          return error("Tasting draft was not saved before posting");
        }
        drafts.delete(draft.id);
        return response({
          tasting: buildTasting({
            bottle: draft.bottle,
            notes: draft.notes,
            ratingBand: draft.ratingBand,
            tags: draft.tags,
          }),
          awards: [],
        });
      }
      default:
        return null;
    }
  }

  return { handleRpcRequest };
}
