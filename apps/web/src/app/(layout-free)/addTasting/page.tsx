"use client";

import type { Outputs } from "@peated/server/orpc/router";
import BadgeImage from "@peated/web/components/badgeImage";
import BottleResolver, {
  type BottleResolverTarget,
} from "@peated/web/components/bottleResolver";
import { useFlashMessages } from "@peated/web/components/flash";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import Link from "@peated/web/components/link";
import TastingForm from "@peated/web/components/tastingForm";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SubmitStage = "saving" | "preparing-photo" | "uploading-photo" | "done";
type SuggestedTags = Outputs["bottles"]["suggestedTags"];
type TastingSubmitData = Parameters<
  ComponentProps<typeof TastingForm>["onSubmit"]
>[0];
type SelectedTarget = BottleResolverTarget & {
  suggestedTags: SuggestedTags;
};

const submitStageCopy: Record<SubmitStage, { title: string; detail: string }> =
  {
    saving: {
      title: "Saving tasting",
      detail: "Recording the bottle, rating, notes, and awards.",
    },
    "preparing-photo": {
      title: "Preparing photo",
      detail: "Optimizing the image before upload.",
    },
    "uploading-photo": {
      title: "Uploading photo",
      detail: "Attaching the photo to your tasting.",
    },
    done: {
      title: "Finishing up",
      detail: "Taking you to the tasting page.",
    },
  };

function getTastingSearchHref(query = "") {
  return `/search?tasting${query ? `&q=${encodeURIComponent(query)}` : ""}`;
}

function TastingSubmitProgressPanel({
  previewUrl,
  stage,
}: {
  previewUrl: string | null;
  stage: SubmitStage;
}) {
  const copy = submitStageCopy[stage];
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [previewUrl]);

  return (
    <Layout
      footer={null}
      header={
        <Header>
          <div className="flex w-full items-center gap-3">
            <h1 className="text-2xl font-bold">Log Tasting</h1>
          </div>
        </Header>
      }
    >
      <section
        className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-3 py-8 text-center sm:py-10"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-md space-y-5 sm:flex sm:max-w-3xl sm:items-center sm:gap-8 sm:space-y-0 sm:text-left">
          {previewUrl && !imageFailed && (
            <img
              src={previewUrl}
              alt="Selected bottle label"
              className="mx-auto h-28 w-28 rounded object-cover sm:mx-0 sm:h-56 sm:w-56"
              onError={() => setImageFailed(true)}
            />
          )}
          <div>
            <h2 className="add-tasting-loading-shimmer via-highlight inline-block bg-gradient-to-r from-white to-white bg-[length:200%_100%] bg-clip-text text-xl font-semibold text-transparent">
              {copy.title}
            </h2>
            <p className="text-muted mt-2 text-sm">{copy.detail}</p>
            <p className="text-muted mt-1 text-sm">
              Keep this page open while we finish.
            </p>
          </div>
        </div>
      </section>
      <style jsx global>{`
        @keyframes add-tasting-loading-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .add-tasting-loading-shimmer {
          animation: add-tasting-loading-shimmer 2.4s ease-in-out infinite;
        }
      `}</style>
    </Layout>
  );
}

export default function AddTasting() {
  return (
    <AuthRequired>
      <AddTastingForm />
    </AuthRequired>
  );
}

function AddTastingForm() {
  const router = useRouter();
  const orpc = useORPC();
  const submitPreviewObjectUrlRef = useRef<string | null>(null);
  const createdAt = useMemo(() => new Date().toISOString(), []);

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    null,
  );
  const [submitPreviewUrl, setSubmitPreviewUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitStage, setSubmitStage] = useState<SubmitStage | null>(null);

  const { flash } = useFlashMessages();
  const tastingCreateMutation = useMutation(
    orpc.tastings.create.mutationOptions(),
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions(),
  );

  useEffect(() => {
    return () => {
      if (submitPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(submitPreviewObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedTarget?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedTarget.previewUrl);
      }
    };
  }, [selectedTarget?.previewUrl]);

  async function resolveTastingTarget(target: BottleResolverTarget) {
    const suggestedTags = await orpc.bottles.suggestedTags.call({
      bottle: target.bottle.id,
    });
    setSelectedTarget({ ...target, suggestedTags });
  }

  async function submitTasting({ image, ...data }: TastingSubmitData) {
    if (!selectedTarget) return;

    setSubmitError(undefined);
    if (submitPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(submitPreviewObjectUrlRef.current);
      submitPreviewObjectUrlRef.current = null;
    }
    if (image instanceof File) {
      const imageUrl = URL.createObjectURL(image);
      submitPreviewObjectUrlRef.current = imageUrl;
      setSubmitPreviewUrl(imageUrl);
    } else if (image instanceof HTMLCanvasElement) {
      setSubmitPreviewUrl(image.toDataURL());
    } else if (image === undefined) {
      setSubmitPreviewUrl(
        selectedTarget.pendingImage?.imageUrl ?? selectedTarget.previewUrl,
      );
    } else {
      setSubmitPreviewUrl(null);
    }
    setSubmitStage("saving");

    try {
      const pendingImageId =
        image === undefined ? selectedTarget.pendingImage?.id : undefined;

      const { tasting, awards } = await tastingCreateMutation.mutateAsync({
        ...data,
        bottle: selectedTarget.bottle.id,
        release:
          data.release === undefined
            ? (selectedTarget.release?.id ?? null)
            : data.release,
        createdAt,
        pendingImageId,
      });

      if (!tasting) {
        setSubmitStage(null);
        setSubmitError("We couldn't save that tasting. Try again.");
        return;
      }

      if (image && !(image instanceof File)) {
        setSubmitStage("preparing-photo");
      }
      const imageFile =
        image instanceof File ? image : image ? await toBlob(image) : null;

      if (imageFile) {
        try {
          setSubmitStage("uploading-photo");
          await tastingImageUpdateMutation.mutateAsync({
            tasting: tasting.id,
            file: imageFile,
          });
        } catch (err) {
          logError(err);
          flash(
            "There was an error uploading your image, but the tasting was saved.",
            "error",
          );
        }
      }

      setSubmitStage("done");

      for (const award of awards) {
        if (award.level != award.prevLevel && award.level) {
          flash(
            <div className="relative flex flex-row items-center gap-x-3">
              <Link
                href={`/badges/${award.badge.id}`}
                className="absolute inset-0"
              />
              <BadgeImage badge={award.badge} size={48} level={award.level} />
              <div className="flex flex-col">
                <h5 className="font-semibold">{award.badge.name}</h5>
                <p className="font-normal">
                  You've reached level {award.level}!
                </p>
              </div>
            </div>,
            "info",
          );
        }
      }

      router.push(`/tastings/${tasting.id}`);
    } catch (err) {
      setSubmitStage(null);
      setSubmitError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "CONFLICT"],
        }),
      );
    }
  }

  if (!selectedTarget) {
    return (
      <BottleResolver
        title="Log Tasting"
        searchHrefForQuery={getTastingSearchHref}
        onResolve={resolveTastingTarget}
      />
    );
  }

  return (
    <>
      <div className={submitStage ? "hidden" : undefined}>
        <TastingForm
          title="Log Tasting"
          errorMessage={submitError}
          initialData={{
            bottle: selectedTarget.bottle,
            release: selectedTarget.release,
            imageUrl: selectedTarget.pendingImage?.imageUrl,
          }}
          showReleasePickerDefault
          suggestedTags={selectedTarget.suggestedTags}
          onSubmit={submitTasting}
        />
      </div>
      {submitStage && (
        <TastingSubmitProgressPanel
          previewUrl={submitPreviewUrl}
          stage={submitStage}
        />
      )}
    </>
  );
}
