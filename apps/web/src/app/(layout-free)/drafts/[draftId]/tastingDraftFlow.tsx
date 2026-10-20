"use client";

import { isORPCNotFoundError } from "@peated/orpc/client/errors";
import type { Bottle } from "@peated/server/types";
import { createIdempotencyKey } from "@peated/web/components/bottleResolver/helpers";
import {
  BottleResolverColumn,
  BottleResolverIntroduction,
  BottleResolverSection,
} from "@peated/web/components/bottleResolver/layout.stylex";
import { PhotoPreview } from "@peated/web/components/bottleResolver/photoPreview.stylex";
import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { LoadingList } from "@peated/web/components/feedback.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import {
  FormNotice,
  FormStack,
} from "@peated/web/components/formLayout.stylex";
import { getCreateBottleHref } from "@peated/web/components/search/createBottleHref";
import { Search as BottleSearch } from "@peated/web/components/search/search.stylex";
import { SelectedBottleSummary } from "@peated/web/components/selectedBottleSummary.stylex";
import { Timestamp } from "@peated/web/components/timestamp";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import TastingForm, {
  type TastingEditFormSubmitData,
} from "@peated/web/features/tastings/tastingForm";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import type { ImageUploadValue } from "@peated/web/lib/imageUpload";
import { useORPC } from "@peated/web/lib/orpc/context";
import { isORPCAccountRedirectError } from "@peated/web/lib/orpc/link";
import {
  buildTastingDraftSaveInput,
  getExistingBottleConflictId,
  getTastingDraftBottleHref,
  getTastingDraftHref,
  getTastingDraftPhotoChange,
  getTastingDraftSuggestion,
  postTastingDraft,
  type TastingDraft,
} from "@peated/web/lib/tastingDrafts";
import { getTastingUrl } from "@peated/web/lib/urls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { BadgeAwardMessage } from "../../addBottle/badgeAwardMessage.stylex";

const TITLE = "Finish tasting";
// Identification runs in the background; check back while it is pending.
const IDENTIFICATION_POLL_MS = 5_000;

function parseBottleId(value: string | null) {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Finishes a tasting draft: confirm its Bottle, edit the details, then post.
 * Nothing posts and no Bottle is chosen without the member confirming it.
 */
export default function TastingDraftFlow({ draftId }: { draftId: string }) {
  return (
    <AuthRequired>
      <TastingDraftFlowContent draftId={draftId} />
    </AuthRequired>
  );
}

function TastingDraftFlowContent({ draftId }: { draftId: string }) {
  const orpc = useORPC();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const draftHref = getTastingDraftHref({ id: draftId });
  const draftQueryOptions = orpc.tastingDrafts.details.queryOptions({
    input: { draft: draftId },
  });
  const draftQuery = useQuery({
    ...draftQueryOptions,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const draft = query.state.data;
      return draft && !draft.bottle && draft.identification.status === "pending"
        ? IDENTIFICATION_POLL_MS
        : false;
    },
  });

  // A Bottle picked from search arrives as `?bottle=`; one that already
  // exists comes back from create-bottle as a conflict.
  const pickedBottleId = parseBottleId(searchParams.get("bottle"));
  const [existingBottleId, setExistingBottleId] = useState<number | null>(null);
  const choiceBottleId = pickedBottleId ?? existingBottleId;
  const choiceQuery = useQuery({
    ...orpc.bottles.details.queryOptions({
      input: { bottle: choiceBottleId ?? 0 },
    }),
    enabled: choiceBottleId !== null,
  });
  const [changingBottle, setChangingBottle] = useState(false);
  const [bottleError, setBottleError] = useState<string>();
  const [posted, setPosted] = useState(false);
  const savedImageRef = useRef<ImageUploadValue>(undefined);

  const upsertMutation = useMutation(
    orpc.tastingDrafts.upsert.mutationOptions(),
  );
  const createBottleMutation = useMutation(
    orpc.tastingDrafts.createBottle.mutationOptions(),
  );
  const publishMutation = useMutation(
    orpc.tastingDrafts.publish.mutationOptions(),
  );
  const pendingUploadMutation = useMutation(
    orpc.pendingUploads.create.mutationOptions(),
  );

  function storeDraft(draft: TastingDraft) {
    queryClient.setQueryData(draftQueryOptions.queryKey, draft);
  }

  async function chooseBottle(draft: TastingDraft, bottleId: number) {
    setBottleError(undefined);
    try {
      storeDraft(
        await upsertMutation.mutateAsync(
          buildTastingDraftSaveInput(draft, { bottle: bottleId }),
        ),
      );
      setExistingBottleId(null);
      setChangingBottle(false);
      if (pickedBottleId !== null) router.replace(draftHref);
    } catch (error) {
      setBottleError(
        getFormErrorMessage(error, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
          fallbackMessage: "We couldn't save that bottle. Try again.",
        }),
      );
    }
  }

  async function addProposedBottle() {
    setBottleError(undefined);
    try {
      const result = await createBottleMutation.mutateAsync({
        draft: draftId,
      });
      for (const warning of result.warnings ?? []) {
        flash(warning.message, "error");
      }
      storeDraft(result.draft);
      setChangingBottle(false);
    } catch (error) {
      if (isORPCAccountRedirectError(error)) return;
      const existing = getExistingBottleConflictId(error);
      if (existing !== null) {
        setExistingBottleId(existing);
        return;
      }
      setBottleError(
        getFormErrorMessage(error, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
          fallbackMessage:
            "We couldn't add that bottle. Search for it instead.",
        }),
      );
    }
  }

  async function getPendingImageId(image: ImageUploadValue) {
    const change = getTastingDraftPhotoChange(image, savedImageRef.current);
    if (change === "remove") return null;
    if (change === "keep" || !image) return undefined;
    const upload = await pendingUploadMutation.mutateAsync({
      file: image instanceof File ? image : await toBlob(image),
      purpose: "photo_tasting_entry",
      idempotencyKey: createIdempotencyKey(),
    });
    return upload.id;
  }

  async function saveDetails(
    draft: TastingDraft,
    { image, ...fields }: TastingEditFormSubmitData,
  ) {
    const input = buildTastingDraftSaveInput(draft, fields);
    // Leaving `pendingImageId` out keeps the draft's photo.
    const pendingImageId = await getPendingImageId(image);
    if (pendingImageId !== undefined) input.pendingImageId = pendingImageId;
    const saved = await upsertMutation.mutateAsync(input);
    savedImageRef.current = image;
    storeDraft(saved);
  }

  async function post(draft: TastingDraft, data: TastingEditFormSubmitData) {
    const { tasting, awards } = await postTastingDraft({
      save: () => saveDetails(draft, data),
      publish: () => publishMutation.mutateAsync({ draft: draftId }),
    });
    for (const award of awards) {
      if (award.level != award.prevLevel && award.level) {
        flash(
          <BadgeAwardMessage badge={award.badge} level={award.level} />,
          "info",
        );
      }
    }
    // Every mutation refreshes all queries, and the posted draft no longer
    // exists, so stop showing it while the tasting opens.
    setPosted(true);
    router.push(getTastingUrl(tasting));
  }

  if (posted) {
    return (
      <WorkflowScreen title={TITLE}>
        <LoadingList label="Opening your tasting" rows={2} />
      </WorkflowScreen>
    );
  }

  if (draftQuery.isPending) {
    return (
      <WorkflowScreen title={TITLE}>
        <LoadingList label="Loading draft" rows={2} />
      </WorkflowScreen>
    );
  }

  if (draftQuery.isError) {
    const gone = isORPCNotFoundError(draftQuery.error);
    return (
      <WorkflowScreen onClose={() => router.push("/drafts")} title={TITLE}>
        <FormStack>
          <FormNotice role="alert">
            {gone
              ? "This draft is gone. It was posted or deleted."
              : "We couldn't load this draft. Try again."}
          </FormNotice>
          {gone ? null : (
            <Button
              fullWidth
              onClick={() => void draftQuery.refetch()}
              variant="accent"
            >
              Try again
            </Button>
          )}
          <ButtonLink fullWidth href="/drafts" variant="tonal">
            Back to drafts
          </ButtonLink>
        </FormStack>
      </WorkflowScreen>
    );
  }

  const draft = draftQuery.data;

  if (draft.bottle && !changingBottle && choiceBottleId === null) {
    return (
      <TastingDraftDetails
        bottle={draft.bottle}
        draft={draft}
        onChangeBottle={() => setChangingBottle(true)}
        onPost={(data) => post(draft, data)}
        onSaveDraft={(data) => saveDetails(draft, data)}
      />
    );
  }

  return (
    <TastingDraftBottleStep
      choice={
        choiceBottleId === null
          ? null
          : {
              bottle: choiceQuery.data ?? null,
              failed: choiceQuery.isError,
              existing: existingBottleId !== null && pickedBottleId === null,
            }
      }
      choosing={upsertMutation.isPending}
      creating={createBottleMutation.isPending}
      draft={draft}
      error={bottleError}
      getBottleHref={(bottle) =>
        getTastingDraftBottleHref({ id: draftId }, bottle.id)
      }
      onAddProposedBottle={() => void addProposedBottle()}
      onChooseBottle={(bottleId) => void chooseBottle(draft, bottleId)}
      onClose={() => router.push("/drafts")}
      onKeepBottle={() => setChangingBottle(false)}
    />
  );
}

function TastingDraftDetails({
  bottle,
  draft,
  onChangeBottle,
  onPost,
  onSaveDraft,
}: {
  bottle: Bottle;
  draft: TastingDraft;
  onChangeBottle: () => void;
  onPost: (data: TastingEditFormSubmitData) => Promise<void>;
  onSaveDraft: (data: TastingEditFormSubmitData) => Promise<void>;
}) {
  const orpc = useORPC();
  const suggestedTags = useQuery(
    orpc.bottles.suggestedTags.queryOptions({ input: { bottle: bottle.id } }),
  );

  // Don't wait for tag suggestions: every save refreshes all queries, and
  // swapping the form for a loading screen would reset its step.
  return (
    <TastingForm
      // Remount when the Bottle changes so its suggestions reset.
      key={bottle.id}
      initialData={{
        bottle,
        color: draft.color,
        friends: draft.friends,
        imageUrl: draft.imageUrl,
        notes: draft.notes,
        ratingBand: draft.ratingBand,
        servingStyle: draft.servingStyle,
        tags: draft.tags,
      }}
      mode="draft"
      onChangeBottle={onChangeBottle}
      onSaveDraft={onSaveDraft}
      onSubmit={onPost}
      // Suggestions only help pick tags; members can still find any tag.
      suggestedTags={suggestedTags.data ?? { results: [] }}
      title={TITLE}
    />
  );
}

function TastingDraftBottleStep({
  choice,
  choosing,
  creating,
  draft,
  error,
  getBottleHref,
  onAddProposedBottle,
  onChooseBottle,
  onClose,
  onKeepBottle,
}: {
  choice: { bottle: Bottle | null; failed: boolean; existing: boolean } | null;
  choosing: boolean;
  creating: boolean;
  draft: TastingDraft;
  error?: string;
  getBottleHref: (bottle: { id: number }) => string;
  onAddProposedBottle: () => void;
  onChooseBottle: (bottleId: number) => void;
  onClose: () => void;
  onKeepBottle: () => void;
}) {
  const suggestion = getTastingDraftSuggestion(draft);
  const identifying = suggestion.kind === "identifying";
  const busy = choosing || creating;
  const offersBottle =
    Boolean(choice || draft.bottle) ||
    suggestion.kind === "match" ||
    suggestion.kind === "proposal";

  return (
    <WorkflowScreen onClose={onClose} title={TITLE}>
      <BottleResolverColumn>
        <BottleResolverIntroduction
          description={
            <>
              You had it on{" "}
              <Timestamp date={draft.tastedAt} format="dateLong" />.
              {draft.bottleHint ? <> You noted “{draft.bottleHint}”.</> : null}
            </>
          }
          title="Which bottle was it?"
        />
        {draft.imageUrl ? (
          <PhotoPreview
            loading={identifying}
            metadata={
              identifying
                ? "Reading the label. You can search while you wait."
                : "Saved with your draft"
            }
            src={draft.imageUrl}
            title={identifying ? "Reading the label" : "Your photo"}
          />
        ) : null}

        {choice ? (
          <BottleResolverSection
            title={
              choice.existing
                ? "This bottle is already on Peated"
                : "Use this bottle?"
            }
          >
            {choice.bottle ? (
              <>
                <SelectedBottleSummary bottle={choice.bottle} />
                <Button
                  disabled={busy}
                  fullWidth
                  loading={choosing}
                  onClick={() => onChooseBottle(choice.bottle!.id)}
                  variant="accent"
                >
                  Use this bottle
                </Button>
              </>
            ) : choice.failed ? (
              <FormNotice role="alert">
                We couldn't load that bottle. Search for it again.
              </FormNotice>
            ) : (
              <LoadingList label="Loading bottle" rows={1} />
            )}
          </BottleResolverSection>
        ) : draft.bottle ? (
          <BottleResolverSection title="Current bottle">
            <SelectedBottleSummary bottle={draft.bottle} />
            <Button fullWidth onClick={onKeepBottle} variant="tonal">
              Keep this bottle
            </Button>
          </BottleResolverSection>
        ) : suggestion.kind === "match" ? (
          <BottleResolverSection
            description="Check the edition and strength against your label."
            title="Is this it?"
          >
            <SelectedBottleSummary bottle={suggestion.bottle} />
            <Button
              disabled={busy}
              fullWidth
              loading={choosing}
              onClick={() => onChooseBottle(suggestion.bottle.id)}
              variant="accent"
            >
              Use this bottle
            </Button>
          </BottleResolverSection>
        ) : suggestion.kind === "proposal" ? (
          <BottleResolverSection
            description="This bottle isn't on Peated yet. Add it and use it for this tasting."
            title={suggestion.name}
          >
            <Button
              disabled={busy}
              fullWidth
              loading={creating}
              onClick={onAddProposedBottle}
              variant="accent"
            >
              <Plus aria-hidden="true" size={16} />
              Add this bottle
            </Button>
          </BottleResolverSection>
        ) : suggestion.kind === "unknown" ? (
          <FormNotice>
            We couldn't tell which bottle this is from the photo. Search for it
            below.
          </FormNotice>
        ) : null}

        {error ? <FormNotice role="alert">{error}</FormNotice> : null}

        <BottleResolverSection
          title={
            offersBottle ? "Search for another bottle" : "Search for the bottle"
          }
        >
          <BottleSearch
            getBottleHref={getBottleHref}
            getContributionHref={(query) =>
              getCreateBottleHref({ query, returnDraftId: draft.id })
            }
            // The hint starts a search only when nothing else is offered, so
            // its results don't crowd out a suggestion.
            initialQuery={offersBottle ? "" : (draft.bottleHint ?? "")}
            initialScope="bottles"
            placement="page"
            placeholder="Search by bottle, brand, or distiller…"
            scopeValues={["bottles"]}
            showBottleRatings={false}
          />
        </BottleResolverSection>
      </BottleResolverColumn>
    </WorkflowScreen>
  );
}
