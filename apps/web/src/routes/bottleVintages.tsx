import { useParams } from "react-router-dom";
import EmptyActivity from "../components/emptyActivity";
import VintageTable from "../components/vintageTable";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Edition, Paginated } from "../types";

export default function BottleVintages() {
  const { bottleId } = useParams();
  if (!bottleId) return null;
  const { data: editionList } = useSuspenseQuery(
    ["bottle", bottleId, "editions"],
    (): Promise<Paginated<Edition>> => api.get(`/bottles/${bottleId}/editions`),
  );

  return (
    <>
      {editionList.results.length ? (
        <VintageTable values={editionList.results} rel={editionList.rel} />
      ) : (
        <EmptyActivity>
          Looks like no ones recorded any vintages for this spirit.
        </EmptyActivity>
      )}
    </>
  );
}
