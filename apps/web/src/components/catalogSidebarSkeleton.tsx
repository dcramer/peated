export default function CatalogSidebarSkeleton({
  sections = 3,
}: {
  sections?: number;
}) {
  return (
    <div className="px-5 py-8" aria-hidden="true">
      <div className="h-5 w-24 animate-pulse rounded bg-slate-800" />
      <ul role="list" className="mt-6 flex flex-col gap-y-5">
        {Array.from({ length: sections }).map((_, sectionIndex) => (
          <li key={sectionIndex}>
            <div className="h-3 w-16 animate-pulse rounded bg-slate-800" />
            <div className="mt-2 h-9 animate-pulse rounded bg-slate-800" />
          </li>
        ))}
      </ul>
    </div>
  );
}
