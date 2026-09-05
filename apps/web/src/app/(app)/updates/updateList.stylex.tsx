import type { Change, PagingRel } from "@peated/server/types";

import {
  Avatar,
  CursorPager,
  ItemList,
  ItemRow,
  LoadingPlaceholder,
  TextLink,
} from "@peated/web/components";
import TimeSince from "@peated/web/components/timeSince";
import { getCursorHref } from "@peated/web/lib/cursorHref";

const loadingRows = [
  { description: 2, metadata: 1, title: 0 },
  { description: 3, metadata: 2, title: 1 },
  { description: 0, metadata: 3, title: 2 },
  { description: 1, metadata: 0, title: 3 },
] as const;

function changeVerb(type: Change["type"]) {
  switch (type) {
    case "add":
      return "added";
    case "update":
      return "updated";
    case "delete":
      return "deleted";
  }
}

export function UpdateList({
  changes,
  page,
  rel,
}: {
  changes: Change[];
  page: number;
  rel: PagingRel;
}) {
  return (
    <>
      <ItemList ariaLabel="Database updates">
        {changes.map((change) => {
          const actor = change.createdByActor;
          const href = `/${change.objectType === "bottle" ? "bottles" : "entities"}/${change.objectId}`;
          return (
            <ItemRow
              description={
                <>
                  {actor.user ? (
                    <TextLink href={`/users/${actor.user.username}`}>
                      {actor.displayName}
                    </TextLink>
                  ) : (
                    actor.displayName
                  )}{" "}
                  {changeVerb(change.type)} the {change.objectType}{" "}
                  <TextLink href={href}>
                    {change.displayName ?? `#${change.objectId}`}
                  </TextLink>
                </>
              }
              key={change.id}
              leading={
                <Avatar
                  imageUrl={actor.user?.pictureUrl}
                  initials={actor.displayName.slice(0, 2).toLocaleUpperCase()}
                />
              }
              metadata={<TimeSince date={change.createdAt} />}
              title={change.displayName ?? `${change.objectType} update`}
            />
          );
        })}
      </ItemList>
      <CursorPager
        ariaLabel="Update pages"
        nextHref={getCursorHref("/updates", {}, rel.nextCursor)}
        page={page}
        previousHref={getCursorHref("/updates", {}, rel.prevCursor)}
      />
    </>
  );
}

export function UpdateListLoading() {
  return (
    <div aria-busy="true" aria-label="Loading database updates" role="status">
      <ItemList ariaLabel="Loading database updates">
        {loadingRows.map((delay, index) => (
          <ItemRow
            description={
              <LoadingPlaceholder delay={delay.description} preset="text" />
            }
            key={index}
            leading={<Avatar initials="" />}
            metadata={
              <LoadingPlaceholder delay={delay.metadata} preset="metadata" />
            }
            title={<LoadingPlaceholder delay={delay.title} preset="text" />}
          />
        ))}
      </ItemList>
    </div>
  );
}
