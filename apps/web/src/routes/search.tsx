import { SearchPanel } from "@peated/web/components/search";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().default(""),
  tasting: z
    .string()
    .optional()
    .transform((v) => v === "1"),
});

export const Route = createFileRoute("/search")({
  component: Page,
  validateSearch: searchSchema,
});

function Page() {
  const { q: query, tasting } = Route.useSearch();

  return <SearchPanel initialValue={query} directToTasting={!!tasting} />;
}
