import { useParams } from "react-router-dom";
import EmptyActivity from "../components/emptyActivity";
import TastingList from "../components/tastingList";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Paginated, Tasting } from "../types";

export default function BottleActivity() {
  const { bottleId } = useParams();
  if (!bottleId) return null;
  const { data: tastingList } = useSuspenseQuery(
    ["bottle", bottleId, "tastings"],
    (): Promise<Paginated<Tasting>> =>
      api.get(`/tastings`, {
        query: { bottle: parseInt(bottleId, 10) },
      }),
  );

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity to={`/bottles/${bottleId}/addTasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded this spirit. You could be the first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
