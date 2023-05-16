import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/layout";
import TastingListItem from "../components/tastingListItem";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Tasting } from "../types";

export default function TastingDetails() {
  const navigate = useNavigate();
  const { tastingId } = useParams();
  const { data } = useSuspenseQuery(
    ["tastings", tastingId],
    (): Promise<Tasting> => api.get(`/tastings/${tastingId}`),
  );

  return (
    <Layout gutter>
      <ul>
        <TastingListItem
          tasting={data}
          onDelete={() => {
            navigate("/");
          }}
        />
      </ul>
    </Layout>
  );
}
