import { SearchPanel } from "@peated/web/components/search";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) ?? "",
  }),
});

function Page() {
  const { q: query } = Route.useSearch();

  return <SearchPanel initialValue={query} />;
}
