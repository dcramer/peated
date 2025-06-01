import type { User } from "@peated/server/types";
import DefaultAvatar from "@peated/web/assets/default-avatar.svg";

export function UserAvatarSkeleton({ size }: { size?: number }) {
  return (
    <div
      className="h-full w-full animate-pulse rounded bg-slate-800"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

export default function UserAvatar({
  user,
  size,
}: {
  user?: User | null;
  size?: number;
}) {
  if (user?.pictureUrl) {
    return (
      <img
        src={user.pictureUrl}
        className="h-full w-full rounded bg-slate-900 object-cover"
        alt="avatar"
        style={{
          width: size,
          height: size,
        }}
      />
    );
  }

  return (
    <DefaultAvatar
      className="h-full w-full rounded bg-slate-900 text-muted"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
