import { AtSymbolIcon } from "@heroicons/react/20/solid";
import type { User } from "@peated/server/types";
import Link from "@peated/web/components/link";
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
            href={`/users/${user.username}`}
            className="inline-flex items-center font-semibold leading-6"
          >
            <AtSymbolIcon className="inline h-3 w-3" />
            {user.username}
          </Link>
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
