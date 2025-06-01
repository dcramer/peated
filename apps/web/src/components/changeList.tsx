import type { Change, PagingRel, User } from "@peated/server/types";
import { Link } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import ListItem from "./listItem";
import PaginationButtons from "./paginationButtons";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

const ChangeAuthor = ({ user }: { user?: User | null }) => {
  if (!user) return <div>An anonymous wizard</div>;
  return (
    <div className="flex items-center gap-x-2">
      <Link
        to={`/users/${user.username}`}
        className="font-medium text-highlight hover:underline"
      >
        {user.username}
      </Link>
    </div>
  );
};

const ChangeType = ({ type }: { type: string }) => {
  switch (type) {
    case "add":
      return <div>added</div>;
    case "update":
      return <div>updated</div>;
    case "delete":
      return <div>deleted</div>;
    default:
      throw new Error(`Invalid change type: ${type}`);
  }
};

const ObjectDesc = ({
  objectType,
  objectId,
  displayName,
}: {
  objectType: string;
  objectId: number;
  displayName?: string | null;
}) => {
  switch (objectType) {
    case "entity":
      return (
        <>
          <div>the entity</div>
          <Link
            to={`/entities/${objectId}`}
            className="font-medium text-highlight hover:underline"
          >
            {displayName}
          </Link>
        </>
      );
    case "bottle":
      return (
        <>
          <div>the bottle</div>
          <Link
            to={`/bottles/${objectId}`}
            className="font-medium text-highlight hover:underline"
          >
            {displayName}
          </Link>
        </>
      );
    default:
      throw new Error(`Invalid object type: ${objectType}`);
  }
};

export default function ChangeList({
  values,
  rel,
}: {
  values: Change[];
  rel?: PagingRel;
}) {
  return (
    <>
      <ul className="divide-y divide-slate-800 sm:rounded">
        <AnimatePresence>
          {values.map((change) => (
            <ListItem key={change.id}>
              <div className="flex items-center gap-x-2 text-sm">
                <UserAvatar user={change.createdBy} size={36} />
                <div>
                  <div className="flex flex-wrap items-start justify-start gap-x-1">
                    <ChangeAuthor user={change.createdBy} />
                    <ChangeType type={change.type} />
                    <ObjectDesc
                      objectType={change.objectType}
                      objectId={change.objectId}
                      displayName={change.displayName}
                    />
                  </div>
                  <div className="text-muted">
                    <TimeSince date={change.createdAt} />
                  </div>
                </div>
              </div>
            </ListItem>
          ))}
        </AnimatePresence>
      </ul>
      <PaginationButtons rel={rel} />
    </>
  );
}
