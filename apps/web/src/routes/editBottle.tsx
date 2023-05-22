import { useNavigate, useParams } from "react-router-dom";

import BottleForm from "../components/bottleForm";
import Spinner from "../components/spinner";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Bottle } from "../types";

export default function EditBottle() {
  const navigate = useNavigate();
  const { bottleId } = useParams();
  const { data: bottle } = useSuspenseQuery(
    ["bottles", bottleId],
    (): Promise<Bottle> => api.get(`/bottles/${bottleId}`),
    { cacheTime: 0 },
  );

  if (!bottle) return <Spinner />;
  return (
    <BottleForm
      onSubmit={async (data) => {
        await api.put(`/bottles/${bottle.id}`, {
          data,
        });
        navigate(`/bottles/${bottle.id}`);
      }}
      initialData={bottle}
      title="Edit Bottle"
    />
  );
}
