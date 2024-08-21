import ListItem from "../listItem";

export function SkeletonItem() {
  return (
    <ListItem noHover>
      <div className="hidden h-12 w-12 flex-none p-2 sm:block" />

      <div className="min-w-0 flex-auto animate-pulse">
        <div className="overflow-hidden rounded bg-slate-800 -indent-96 font-semibold leading-6">
          Title
        </div>
      </div>
    </ListItem>
  );
}
