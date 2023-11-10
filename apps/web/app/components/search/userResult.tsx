import { AtSymbolIcon } from "@heroicons/react/20/solid";
import type { User } from "@peated/server/types";
import { Link } from "@remix-run/react";
import Chip from "../chip";
import UserAvatar from "../userAvatar";

export type UserResult = {
  type: "user";
  ref: User;
};

export default function UserResultRow({
  result: { ref: user },
}: {
  result: UserResult;
}) {
  return (
    <>
      <div className="hidden h-12 w-12 flex-none p-2 sm:block">
        <UserAvatar user={user} />
      </div>

      <div className="flex min-w-0 flex-auto">
        <div className="flex-auto">
          <Link
            to={`/users/${user.username}`}
            className="font-semibold leading-6"
          >
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {user.displayName}
          </Link>
          <div className="text-light flex items-center text-sm">
            <AtSymbolIcon className="inline h-3 w-3" />
            {user.username}
          </div>
        </div>
        <div className="flex gap-x-2">
          {user.admin ? (
            <Chip size="small" color="highlight">
              Admin
            </Chip>
          ) : user.mod ? (
            <Chip size="small" color="highlight">
              Moderator
            </Chip>
          ) : null}
        </div>
      </div>
    </>
  );
}
