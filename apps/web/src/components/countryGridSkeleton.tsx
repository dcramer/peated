export default function CountryGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <ul
      role="list"
      className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-8"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="group relative border border-transparent text-white"
        >
          <div className="flex flex-col items-center justify-center">
            {/* Fixed height container matching the actual component */}
            <div className="mb-4 flex h-40 w-full items-center justify-center bg-slate-900 p-4 lg:h-48 lg:p-8">
              <div
                className="h-full w-3/4 animate-pulse rounded bg-slate-800"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            </div>
            <div
              className="h-6 w-32 animate-pulse rounded bg-slate-800"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
