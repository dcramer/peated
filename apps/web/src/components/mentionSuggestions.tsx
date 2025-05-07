"use client";

import type { User } from "@peated/server/types";
import { trpc } from "@peated/web/lib/trpc/client";
import UserAvatar from "./userAvatar";

type MentionSuggestionsProps = {
  query: string;
  onSelect: (username: string) => void;
  visible: boolean;
};

export default function MentionSuggestions({
  query,
  onSelect,
  visible,
}: MentionSuggestionsProps) {
  // Only search if we have a query and the component is visible
  const enabled = visible && query.length > 0;

  const { data } = trpc.search.useQuery(
    {
      query: query,
      include: ["users"],
      limit: 5,
    },
    {
      enabled,
      staleTime: 10000, // Cache results for 10 seconds
    },
  );

  // If not visible or no results, don't render anything
  if (!visible || !query || !data?.results?.length) {
    return null;
  }

  // Filter to only user results
  const userResults = data.results.filter((r) => r.type === "user");

  if (!userResults.length) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-64 overflow-y-auto rounded bg-slate-800 shadow-lg">
      <ul className="py-1">
        {userResults.map((result) => (
          <li key={result.ref.id}>
            <button
              type="button"
              className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-slate-700"
              onClick={() => onSelect(result.ref.username)}
            >
              <div className="mr-2 h-6 w-6">
                <UserAvatar size={24} user={result.ref} />
              </div>
              <span>{result.ref.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
