import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useParams } from "@remix-run/react";
import invariant from "tiny-invariant";
import BottleForm from "~/components/bottleForm";
import Spinner from "~/components/spinner";
import { trpc } from "~/lib/trpc";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Bottle",
    },
  ];
};

export async function loader({
  params: { bottleId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(bottleId);
  const bottle = await trpc.bottleById.query(Number(bottleId));

  return json({ bottle });
}

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
