import { loadFixture } from "@peated/server/lib/test/fixtures";
import type { ExternalReviewScoringPolicy } from "@peated/server/schemas";
import { once } from "node:events";
import { createServer } from "node:http";
import { z } from "zod";

export type ReviewWebsite = {
  key: "decimal" | "stars" | "points";
  name: string;
  pages: Record<string, string>;
  policy: ExternalReviewScoringPolicy | null;
  reviews: {
    name: string;
    reviewerName: string;
    url: string;
    publishedAt: string;
    nativeScore: { value: number; scale: number; display: string };
    score: number | null;
  }[];
};

export const reviewWebsites: ReviewWebsite[] = [
  {
    key: "decimal",
    name: "Malt Journal",
    pages: {
      "/": "index.html",
      "/reviews": "reviews.html",
      "/reviews/coastal-malt": "coastal-malt.html",
    },
    policy: {
      enabled: true,
      rules: [
        {
          scale: 10,
          guideUrl: "https://malt-journal.example/scoring",
          explanation:
            "This fictional site writes its 100-point scores as decimals.",
          from: null,
          until: null,
          points: [
            { source: 0, target: 0 },
            { source: 10, target: 100 },
          ],
        },
      ],
    },
    reviews: [
      {
        name: "Coastal Malt 12 Year",
        reviewerName: "Mara Vale",
        url: "/reviews/coastal-malt",
        publishedAt: "2026-08-20T09:00:00.000Z",
        nativeScore: { value: 8.7, scale: 10, display: "8.7" },
        score: 87,
      },
    ],
  },
  {
    key: "stars",
    name: "Bourbon Notebook",
    pages: {
      "/": "index.html",
      "/reviews": "reviews.html",
      "/reviews/orchard-bourbon": "orchard-bourbon.html",
    },
    policy: { enabled: false, rules: [] },
    reviews: [
      {
        name: "Orchard Bourbon",
        reviewerName: "Jon Bell",
        url: "/reviews/orchard-bourbon",
        publishedAt: "2026-08-21T00:00:00.000Z",
        nativeScore: { value: 3.5, scale: 5, display: "3.5" },
        score: null,
      },
    ],
  },
  {
    key: "points",
    name: "Whisky Notebook",
    pages: {
      "/": "index.html",
      "/reviews": "reviews.html",
      "/reviews?page=2": "reviews-page-2.html",
      "/reviews/island-pair": "island-pair.html",
      "/reviews/hill-malt": "hill-malt.html",
    },
    policy: null,
    reviews: [
      {
        name: "Island Malt First Release",
        reviewerName: "Mara Vale",
        url: "/reviews/island-pair",
        publishedAt: "2026-08-22T00:00:00.000Z",
        nativeScore: { value: 88, scale: 100, display: "88/100" },
        score: 88,
      },
      {
        name: "Island Malt Loch Edition",
        reviewerName: "Mara Vale",
        url: "/reviews/island-pair",
        publishedAt: "2026-08-22T00:00:00.000Z",
        nativeScore: { value: 85, scale: 100, display: "85/100" },
        score: 85,
      },
      {
        name: "Hill Malt 10 Year",
        reviewerName: "Mara Vale",
        url: "/reviews/hill-malt",
        publishedAt: "2026-08-19T00:00:00.000Z",
        nativeScore: { value: 89, scale: 100, display: "89/100" },
        score: 89,
      },
    ],
  },
];

/** Live model checks serve fixture HTML over HTTP without intercepting model traffic. */
export async function startReviewWebsite(website: ReviewWebsite) {
  const pages = new Map(
    await Promise.all(
      Object.entries(website.pages).map(
        async ([path, file]) =>
          [
            path,
            await loadFixture("scraper-websites", `${website.key}/${file}`),
          ] as const,
      ),
    ),
  );
  const requestedPages: string[] = [];
  const missingPages: string[] = [];
  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    requestedPages.push(path);
    if (path === "/robots.txt") {
      response.setHeader("content-type", "text/plain");
      response.end("User-agent: *\nAllow: /\n");
      return;
    }
    const html = pages.get(path);
    if (html === undefined) {
      missingPages.push(path);
      response.writeHead(404).end();
      return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(html);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = z
    .object({ port: z.number().int().positive() })
    .parse(server.address());
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requestedPages,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (missingPages.length)
        throw new Error(`Unexpected fixture pages: ${missingPages.join(", ")}`);
    },
  };
}
