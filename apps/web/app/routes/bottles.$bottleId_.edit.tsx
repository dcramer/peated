import BottleForm from "@peated/web/components/bottleForm";
import Spinner from "@peated/web/components/spinner";
import { trpc } from "@peated/web/lib/trpc";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Bottle",
    },
  ];
};

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params, context: { trpc } }) => {
    invariant(params.bottleId);

    const bottle = await trpc.bottleById.query(Number(params.bottleId));

    return json({ bottle });
  },
);

export default function EditBottle() {
  const { bottle } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { bottleId } = useParams();
  const bottleUpdateMutation = trpc.bottleUpdate.useMutation();

  if (!bottle) return <Spinner />;

  return (
    <BottleForm
      onSubmit={async (data) => {
        await bottleUpdateMutation.mutateAsync(
          {
            bottle: bottle.id,
            ...data,
          },
          {
            onSuccess: () => navigate(`/bottles/${bottleId}`),
          },
        );
      }}
      initialData={bottle}
      title="Edit Bottle"
    />
  );
}
