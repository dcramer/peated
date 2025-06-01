import BadgeImage from "@peated/web/components/badgeImage";
import { useFlashMessages } from "@peated/web/components/flash";
import { Link } from "@tanstack/react-router";
import TastingForm from "@peated/web/components/tastingForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  skipToken,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/bottles/$bottleId/addTasting")({
  component: Page,
});

function Page() {
  useAuthRequired();

  const { bottleId } = Route.useParams();
  const navigate = useNavigate();
  const orpc = useORPC();

  const search = Route.useSearch();
  const releaseId = search.release;

  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } })
  );

  const { data: suggestedTags } = useSuspenseQuery(
    orpc.bottles.suggestedTags.queryOptions({
      input: { bottle: Number(bottleId) },
    })
  );

  // TODO: we want this to be suspense, but skipToken wont work
  const releaseQuery = useQuery(
    releaseId
      ? orpc.bottleReleases.details.queryOptions({
          input: { release: Number(releaseId) },
        })
      : { queryFn: skipToken, queryKey: ["release", ""] }
  );
  const release = releaseId ? releaseQuery.data : null;

  const flightId = search.flight || null;
  // TODO: we want this to be suspense, but skipToken wont work
  const flightQuery = useQuery(
    flightId
      ? orpc.flights.details.queryOptions({
          input: { flight: flightId },
        })
      : { queryFn: skipToken, queryKey: ["flight", ""] }
  );
  const flight = flightId ? flightQuery.data : null;

  const tastingCreateMutation = useMutation(
    orpc.tastings.create.mutationOptions()
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions()
  );

  // capture this on initial load as its utilized to prevent
  // duplicate tasting submissions
  const createdAt = new Date().toISOString();

  const { flash } = useFlashMessages();

  return (
    <TastingForm
      title="Record Tasting"
      initialData={{ bottle, release }}
      suggestedTags={suggestedTags}
      onSubmit={async ({ image, ...data }) => {
        const { tasting, awards } = await tastingCreateMutation.mutateAsync({
          ...data,
          release: release?.id || null,
          flight: flight?.id || null,
          createdAt,
        });

        if (tasting) {
          if (image) {
            try {
              await tastingImageUpdateMutation.mutateAsync({
                tasting: tasting.id,
                file: await toBlob(image),
              });
            } catch (err) {
              logError(err);
              flash(
                "There was an error uploading your image, but the tasting was saved.",
                "error"
              );
            }
          }

          for (const award of awards) {
            // TODO: show "Youve discovered" flow for level 0 badges
            if (award.level !== award.prevLevel && award.level) {
              flash(
                <div className="relative flex flex-row items-center gap-x-3">
                  <Link
                    to={`/badges/${award.badge.id}`}
                    className="absolute inset-0"
                  />
                  <BadgeImage
                    badge={award.badge}
                    size={48}
                    level={award.level}
                  />
                  <div className="flex flex-col">
                    <h5 className="font-semibold">{award.badge.name}</h5>
                    <p className="font-normal">
                      You've reached level {award.level}!
                    </p>
                  </div>
                </div>,
                "info"
              );
            }
          }
          if (flightId) {
            navigate({ to: `/flights/${flightId}` });
          } else {
            navigate({ to: `/tastings/${tasting.id}` });
          }
        }
      }}
    />
  );
}
