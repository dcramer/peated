"use client";

import Button from "@peated/web/components/button";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import FriendListItem from "./friendListItem";

export const fetchCache = "default-no-store";

export default function Page() {
  return (
    <AuthRequired>
      <FriendsPage />
    </AuthRequired>
  );
}

function FriendsPage() {
  const orpc = useORPC();
  const { data: friendList } = useSuspenseQuery(
    orpc.friends.list.queryOptions({
      input: {},
    }),
  );

  const { results, rel } = friendList;

  return (
    <>
      {results.length ? (
        <ul className="divide-y divide-slate-800 sm:rounded">
          {results.map((friend) => {
            return <FriendListItem key={friend.id} friend={friend} />;
          })}
        </ul>
      ) : (
        <div className="relative mx-3 min-h-64 overflow-hidden border border-slate-800 bg-slate-950 px-6 py-8 sm:mx-0 sm:px-10 sm:py-10">
          <img
            src="/assets/empty-friends-illustration.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/5"
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-[65%] sm:max-w-sm">
            <h2 className="text-xl font-bold text-white">
              Find your tasting circle
            </h2>
            <p className="text-muted mt-2 text-sm">
              Search by username to connect and keep up with what friends are
              tasting.
            </p>
          </div>
          <form
            action="/search"
            className="relative z-10 mt-5 flex max-w-sm gap-2"
          >
            <input type="hidden" name="type" value="users" />
            <label className="sr-only" htmlFor="friend-search">
              Username
            </label>
            <div className="flex h-10 min-w-0 flex-1 items-center rounded border border-slate-800 bg-slate-900 px-3 shadow-sm focus-within:border-slate-600">
              <span className="text-muted" aria-hidden="true">
                @
              </span>
              <input
                id="friend-search"
                name="q"
                type="search"
                placeholder="username"
                className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-0"
              />
            </div>
            <Button color="highlight" type="submit">
              Search
            </Button>
          </form>
        </div>
      )}
      <PaginationButtons rel={rel} />
    </>
  );
}
