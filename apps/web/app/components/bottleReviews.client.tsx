import { TrophyIcon } from "@heroicons/react/24/outline";
import { trpc } from "../lib/trpc";

function RatingIcon({ rating }: { rating: number }) {
  if (rating > 93) return <TrophyIcon className="text-highlight h-4 w-4" />;
  if (rating > 87) return <TrophyIcon className="h-4 w-4 text-gray-400" />;
  if (rating > 83) return <TrophyIcon className="h-4 w-4 text-orange-400" />;
  return null;
}

export default function BottleReviews({ bottleId }: { bottleId: number }) {
  const { data } = trpc.reviewList.useQuery({
    bottle: bottleId,
  });

  if (!data) return null;

  const { results } = data;

  if (!results.length) return null;

  return (
    <>
      <h3 className="text-highlight text-lg font-bold">The Critics</h3>
      <ul className="-mx-2 grid w-2/3 grid-cols-2 md:w-1/2">
        {results.map((r) => {
          return (
            <li
              key={r.id}
              className="relative col-span-3 grid grid-cols-subgrid items-center gap-x-2 gap-y-2 p-2 hover:bg-slate-800"
            >
              <a href={r.url} className="absolute inset-0" />
              <span className="flex items-center gap-x-2">{r.site.name}</span>
              <span className="flex items-center justify-end gap-x-2">
                <RatingIcon rating={r.rating} />
                <span>{r.rating} points</span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
