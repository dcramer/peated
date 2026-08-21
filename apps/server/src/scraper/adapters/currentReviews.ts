import type { ReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { z } from "zod";
import type { ScraperResponse, ScraperSession } from "../types";

export function currentReviewCursorSchema(maxArticles: number) {
  return z
    .object({
      processedArticleUrls: z.array(z.url()).max(maxArticles),
    })
    .strict();
}

type CurrentReviewCursor = {
  processedArticleUrls: string[];
};

/**
 * Owns the current-review window lifecycle. A null parse result is an expected
 * non-review item. It is checkpointed. Parse and emit errors are not.
 */
export async function processCurrentReviews<TArticle>({
  target,
  articles,
  articleUrl,
  cursor,
  session,
  parse,
}: {
  target: string;
  articles: readonly TArticle[];
  articleUrl: (article: TArticle) => URL;
  cursor: CurrentReviewCursor | null;
  session: ScraperSession<CurrentReviewCursor, ReviewArticleIngestion>;
  parse: (
    response: ScraperResponse,
    article: TArticle,
  ) => ReviewArticleIngestion | null;
}) {
  const currentUrls = new Set(
    articles.map((article) => articleUrl(article).href),
  );
  const processedUrls = new Set(
    (cursor?.processedArticleUrls ?? []).filter((url) => currentUrls.has(url)),
  );

  for (const article of articles) {
    const url = articleUrl(article);
    if (processedUrls.has(url.href)) continue;

    const response = await session.request({ target, url });
    const observation = parse(response, article);
    if (observation) {
      await session.emit({
        sourceKey: observation.article.canonicalUrl,
        itemCount: observation.article.reviews.length,
        value: observation,
      });
    }

    processedUrls.add(url.href);
    await session.checkpoint({ processedArticleUrls: [...processedUrls] });
  }
}
