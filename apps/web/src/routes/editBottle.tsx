import { useNavigate, useParams } from "react-router-dom";

import { BottleInputSchema } from "@peated/shared/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import BottleForm from "../components/bottleForm";
import Spinner from "../components/spinner";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Bottle } from "../types";

type FormSchemaType = z.infer<typeof BottleInputSchema>;

export default function EditBottle() {
  const navigate = useNavigate();
  const { bottleId } = useParams();
  const queryClient = useQueryClient();
  const { data: bottle } = useSuspenseQuery(
    ["bottles", bottleId],
    (): Promise<Bottle> => api.get(`/bottles/${bottleId}`),
    { cacheTime: 0 },
  );

  const saveBottle = useMutation({
    mutationFn: async (data: FormSchemaType) => {
      await api.put(`/bottles/${bottleId}`, {
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["bottles", bottleId]);
    },
  });

  if (!bottle) return <Spinner />;

  return (
    <BottleForm
      onSubmit={async (data) => {
        await saveBottle.mutateAsync(data, {
          onSuccess: () => navigate(`/bottles/${bottleId}`),
        });
      }}
      initialData={bottle}
      title="Edit Bottle"
    />
  );
}
