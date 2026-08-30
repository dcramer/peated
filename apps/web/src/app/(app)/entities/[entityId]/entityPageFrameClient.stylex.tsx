"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  AppLink,
  Button,
  ButtonLink,
  PageTabs,
  RowMenu,
  SectionError,
  type RowMenuItem,
} from "@peated/web/components/designSystem/components";
import { EntityPageHeader } from "@peated/web/components/designSystem/patterns/entityPageHeader.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import Markdown from "@peated/web/components/markdown";
import useAuth from "@peated/web/hooks/useAuth";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { logTelemetryError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { effects, space } from "../../../../styles/tokens.stylex";

import {
  getEntityCurrentHref,
  getEntityLocationLabel,
  getEntityPresentation,
  getEntityTabs,
  type Entity,
} from "./entityPageData";

function DistilleryFollowAction({ entity }: { entity: Entity }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [followingOverride, setFollowingOverride] = useState<boolean | null>(
    null,
  );
  const followMutation = useMutation(orpc.entities.follow.mutationOptions());
  const unfollowMutation = useMutation(
    orpc.entities.unfollow.mutationOptions(),
  );

  if (!user) {
    return (
      <ButtonLink
        aria-label={`Follow ${entity.name}`}
        href={`/login?redirectTo=${encodeURIComponent(`/distillers/${entity.id}`)}`}
        size="lg"
        variant="tonal"
      >
        Follow
      </ButtonLink>
    );
  }

  const isFollowing = followingOverride ?? entity.isFollowing;
  const pending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <Button
      aria-label={
        isFollowing ? `Unfollow ${entity.name}` : `Follow ${entity.name}`
      }
      aria-pressed={isFollowing}
      loading={pending}
      loadingLabel={isFollowing ? "Unfollowing…" : "Following…"}
      onClick={async () => {
        try {
          if (isFollowing) {
            await unfollowMutation.mutateAsync({ entity: entity.id });
          } else {
            await followMutation.mutateAsync({ entity: entity.id });
          }
          setFollowingOverride(!isFollowing);
          await queryClient.invalidateQueries({
            queryKey: orpc.entities.details.key({
              input: { entity: entity.id },
            }),
          });
        } catch (error) {
          flash(
            error instanceof Error
              ? error.message
              : "We couldn't update the distilleries you follow. Try again.",
            "error",
          );
        }
      }}
      size="lg"
      variant="tonal"
    >
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}

function EntityActions({ entity }: { entity: Entity }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const deleteMutation = useMutation(orpc.entities.delete.mutationOptions());
  const groups: RowMenuItem[][] = [
    [
      {
        label: "Share",
        onSelect: () => {
          if (navigator.share) {
            navigator
              .share({ title: entity.name, url: window.location.href })
              .catch((error) => logTelemetryError(error, {}));
            return;
          }

          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => flash("Entity link copied."))
            .catch((error) => logTelemetryError(error, {}));
        },
      },
    ],
  ];

  if (user?.mod || user?.admin) {
    groups.push([
      { href: `/entities/${entity.id}/aliases`, label: "View aliases" },
      { href: `/entities/${entity.id}/edit`, label: "Edit entity" },
      { href: `/entities/${entity.id}/merge`, label: "Merge entity" },
    ]);
  }

  if (user?.admin) {
    groups.push([
      {
        disabled: deleteMutation.isPending,
        label: deleteMutation.isPending ? "Deleting entity…" : "Delete entity",
        onSelect: () => {
          if (
            !window.confirm(
              "Permanently delete this entity? This cannot be undone.",
            )
          ) {
            return;
          }

          void deleteMutation
            .mutateAsync({ entity: entity.id })
            .then(() => router.replace("/"))
            .catch((error) => {
              flash(
                error instanceof Error
                  ? error.message
                  : "Unable to delete this entity.",
                "error",
              );
            });
        },
      },
    ]);
  }

  return <RowMenu groups={groups} label={entity.name} variant="page" />;
}

export function EntityPageFrameClient({
  children,
  initialEntity,
  owner,
}: {
  children: ReactNode;
  initialEntity: Entity;
  owner?: Entity | null;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const entityQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: initialEntity.id },
    }),
    initialData: initialEntity,
  });

  if (entityQuery.error) {
    return (
      <SectionError
        heading="Entity details are unavailable"
        onRetry={() => void entityQuery.refetch()}
      >
        We could not load this entity. Try again.
      </SectionError>
    );
  }

  const entity = entityQuery.data;
  const createBottleHref = getEntityBottleCreateHref(entity);
  const presentation = getEntityPresentation(entity);
  const currentHref = getEntityCurrentHref(entity, pathname);

  return (
    <div {...stylex.props(styles.page)}>
      <EntityPageHeader
        actions={
          createBottleHref || entity.kind === "distillery" ? (
            <>
              {createBottleHref ? (
                <ButtonLink href={createBottleHref} size="lg" variant="accent">
                  Add a bottle
                </ButtonLink>
              ) : null}
              {entity.kind === "distillery" ? (
                <DistilleryFollowAction key={entity.id} entity={entity} />
              ) : null}
            </>
          ) : undefined
        }
        description={
          entity.description ? (
            <Markdown content={entity.description} />
          ) : undefined
        }
        detail={presentation.label}
        eyebrow={getEntityLocationLabel(entity) || undefined}
        id={entity.peatedId}
        menu={<EntityActions entity={entity} />}
        parent={
          owner ? (
            <AppLink
              href={getEntityUrl(owner)}
              {...stylex.props(styles.ownerLink)}
            >
              Owned by {owner.shortName || owner.name}
            </AppLink>
          ) : undefined
        }
        specs={[
          {
            label: presentation.establishmentLabel,
            value: entity.yearEstablished,
          },
          { label: "Country", value: entity.country?.name },
          { label: "Bottles", value: entity.totalBottles },
          {
            label: "Tastings",
            value: entity.totalTastings.toLocaleString("en-US"),
          },
        ]}
        title={entity.name}
      />

      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel={`${entity.name} sections`}
          currentHref={currentHref}
          items={getEntityTabs(entity)}
        />
      </div>

      {children}
    </div>
  );
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  tabs: {
    marginTop: space.x6,
  },
  ownerLink: {
    color: "inherit",
    outline: "none",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
