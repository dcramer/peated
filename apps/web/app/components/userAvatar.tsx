import type { User } from "@peated/server/types";

export default function UserAvatar({
  user,
  size,
}: {
  user?: User | null;
  size?: number;
}) {
  if (user && user.pictureUrl) {
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
    <svg
      className="h-full w-full rounded bg-slate-900 text-slate-500"
      fill="currentColor"
      viewBox="0 0 24 24"
      style={{
        width: size,
        height: size,
      }}
    >
      <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
