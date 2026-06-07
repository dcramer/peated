export default function RightSidebarSkeleton({
  sections = 3,
}: {
  sections?: number;
}) {
  return (
    <div
      className="mt-8 flex flex-col overflow-y-auto bg-slate-950 px-6 py-4"
      aria-hidden="true"
    >
      <div className="bg-highlight h-10 w-full animate-pulse rounded" />
      <ul role="list" className="mt-7 flex flex-auto flex-col gap-y-7">
        {Array.from({ length: sections }).map((_, sectionIndex) => (
          <li key={sectionIndex}>
            <div className="h-5 w-24 animate-pulse rounded bg-slate-800" />
            <ul role="list" className="-mx-3 mt-2 space-y-1">
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <li key={itemIndex}>
                  <div className="h-8 animate-pulse rounded bg-slate-800" />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
