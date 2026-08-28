"use client";

import type { Outputs } from "@peated/server/orpc/router";
import type { Friend } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  CursorPager,
  EmptyState,
  RowMenu,
} from "@peated/web/components/designSystem/components";
import {
  Avatar,
  PageHeader,
  RecordList,
  RecordRow,
} from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { Search } from "@peated/web/components/designSystem/product/search.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../styles/tokens.stylex";

type FriendList = Outputs["friends"]["list"];

export function FriendsPageClient({
  initialFriendList,
}: {
  initialFriendList: FriendList;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: { limit: 50 },
  });
  const { data: friendList } = useSuspenseQuery({
    ...orpc.friends.list.queryOptions({ input: queryParams }),
    initialData: initialFriendList,
  });
  const page = Number(searchParams.get("cursor") ?? "1") || 1;

  return (
    <div>
      <PageHeader
        description="The people whose tasting records you follow."
        eyebrow="Your record"
        title="Friends"
      />
      <div {...stylex.props(styles.search)}>
        <Search
          initialScope="members"
          placement="page"
          placeholder="Find a member by username"
          scopeValues={["members"]}
        />
      </div>
      <div {...stylex.props(styles.list)}>
        {friendList.results.length ? (
          <RecordList ariaLabel="Friends">
            {friendList.results.map((friend) => (
              <FriendRow friend={friend} key={friend.id} />
            ))}
          </RecordList>
        ) : (
          <EmptyState heading="No friends yet">
            Search for a member to start following their tasting record.
          </EmptyState>
        )}
        <CursorPager
          ariaLabel="Friend pages"
          nextHref={getCursorHref(
            pathname,
            searchParams,
            friendList.rel.nextCursor,
          )}
          page={page}
          previousHref={getCursorHref(
            pathname,
            searchParams,
            friendList.rel.prevCursor,
          )}
        />
      </div>
    </div>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const orpc = useORPC();
  const [visible, setVisible] = useState(friend.status !== "none");
  const removeFriend = useMutation(
    orpc.friends.delete.mutationOptions({
      onSuccess: () => setVisible(false),
    }),
  );

  if (!visible) return null;

  const { user } = friend;
  const pending = removeFriend.isPending;

  return (
    <RecordRow
      action={
        <RowMenu
          groups={[
            [
              {
                disabled: pending,
                label:
                  friend.status === "pending"
                    ? "Cancel request"
                    : "Remove friend",
                onSelect: () => removeFriend.mutate({ user: user.id }),
              },
            ],
          ]}
          label={user.username}
        />
      }
      href={`/users/${user.username}`}
      leading={
        <Avatar
          imageUrl={user.pictureUrl}
          initials={user.username.slice(0, 2).toLocaleUpperCase()}
        />
      }
      metadata={friend.status === "pending" ? "Request pending" : "Friend"}
      title={user.username}
    />
  );
}

const styles = stylex.create({
  search: { maxWidth: "720px", marginTop: space.x6 },
  list: { maxWidth: "880px", marginTop: space.x6 },
});
