import { TrophyIcon } from "@heroicons/react/24/outline";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useORPC } from "../lib/orpc/context";
import Heading from "./heading";

function RatingIcon({ rating }: { rating: number }) {
  if (rating >= 93) return <TrophyIcon className="h-4 w-4 text-highlight" />;
  if (rating >= 87) return <TrophyIcon className="h-4 w-4 text-gray-400" />;
  if (rating >= 83) return <TrophyIcon className="h-4 w-4 text-orange-400" />;
  return null;
}

export default function BottleReviews({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const {
    data: { results },
  } = useSuspenseQuery(
    orpc.reviews.list.queryOptions({
      input: {
        bottle: bottleId,
      },
    })
  );

  if (!results.length) return null;

  return (
    <>
      <Heading asChild>
        <h3>The Critics</h3>
      </Heading>
      <ul className="-mx-2 -mt-2 mb-4 grid grid-cols-2 sm:w-2/3 md:w-1/2">
        {results.map((r) => {
          if (!r.site) return null;
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
