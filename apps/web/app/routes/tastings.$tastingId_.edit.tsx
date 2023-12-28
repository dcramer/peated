import useApi from "@peated/web/hooks/useApi";
import { redirectToAuth } from "@peated/web/lib/auth";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import TastingForm from "../components/tastingForm";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params: { tastingId }, context: { trpc, user } }) => {
    invariant(tastingId);

    if (!user) return redirectToAuth({ request });

    // TODO: this would be better if done in parallel
    const tasting = await trpc.tastingById.query(Number(tastingId));
    const suggestedTags = await trpc.bottleSuggestedTagList.query({
      bottle: Number(tasting.bottle.id),
    });

    return json({ tasting, suggestedTags });
  },
);

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Tasting",
    },
  ];
};

export default function AddTasting() {
  const { tasting, suggestedTags } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const flight = qs.get("flight") || null;

  const tastingUpdateMutation = trpc.tastingUpdate.useMutation();
  const api = useApi();

  // capture this on initial load as its utilized to prevent
  // duplicate tasting submissions
  const createdAt = new Date().toISOString();

  return (
    <TastingForm
      title="Edit Tasting"
      initialData={tasting}
      suggestedTags={suggestedTags}
      onSubmit={async ({ picture, ...data }) => {
        await tastingUpdateMutation.mutateAsync({
          tasting: tasting.id,
          ...data,
          createdAt,
        });

        if (picture) {
          const blob = await toBlob(picture);
          try {
            // TODO: switch to fetch maybe?
            await api.post(`/tastings/${tasting.id}/image`, {
              data: {
                image: blob,
              },
            });
          } catch (err) {
            logError(err);
            // TODO show some kind of alert, ask them to reusubmit image
          }
        }
        if (tasting) {
          if (flight) {
            navigate(`/flights/${flight}`);
          } else {
            navigate(`/tastings/${tasting.id}`);
          }
        }
      }}
    />
  );
}
