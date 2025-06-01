import ListItem from "@peated/web/components/listItem";
import { UserAvatarSkeleton } from "@peated/web/components/userAvatar";

function SkeletonFriend() {
  return (
    <ListItem as="li">
      <UserAvatarSkeleton size={48} />

      <div className="min-w-0 flex-auto animate-pulse">
        <div className="-indent-96 overflow-hidden rounded bg-slate-800 font-semibold leading-6">
          Title
        </div>
        <div className="-indent-96 mt-2 flex w-32 overflow-hidden truncate rounded bg-slate-800 text-xs leading-5">
          Subtext
        </div>
      </div>
    </ListItem>
  );
}
export default function Loading() {
  return (
    <>
      <ul className="divide-y divide-slate-800 sm:rounded">
        <SkeletonFriend />
        <SkeletonFriend />
        <SkeletonFriend />
      </ul>
    </>
  );
}
