"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import {
  Button,
  ButtonLink,
  ExpandableDescription,
  PageTabs,
  RowMenu,
  SectionError,
  type RowMenuItem,
} from "@peated/web/components";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import useEntityFollowing from "@peated/web/hooks/useEntityFollowing";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { logTelemetryError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";

import {
  getEntityClassification,
  getEntityCurrentHref,
  getEntityPresentation,
  getEntityTabs,
  type Entity,
} from "./entityPageData";

const EntityPageContext = createContext<Entity | null>(null);

function EntityFollowAction({ entity }: { entity: Entity }) {
  const { user } = useAuth();
  const followControls = useEntityFollowing();

  if (!user) {
    return (
      <ButtonLink
        aria-label={`Follow ${entity.name}`}
        href={`/login?redirectTo=${encodeURIComponent(getEntityUrl(entity))}`}
        size="md"
        variant="accent"
      >
        Follow
      </ButtonLink>
    );
  }

  const isFollowing = followControls.isFollowing(entity);
  const pending = followControls.pendingIds.has(entity.id);

  return (
    <Button
      aria-label={
        isFollowing ? `Unfollow ${entity.name}` : `Follow ${entity.name}`
      }
      aria-pressed={isFollowing}
      loading={pending}
      loadingLabel={isFollowing ? "Unfollowing…" : "Following…"}
      onClick={() => followControls.toggle(entity)}
      size="md"
      variant="accent"
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
  const noun = getEntityPresentation(entity).label.toLocaleLowerCase();
  const entityUrl = getEntityUrl(entity);
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
            .then(() => flash(`${noun} link copied.`))
            .catch((error) => logTelemetryError(error, {}));
        },
      },
    ],
  ];

  if (user?.mod || user?.admin) {
    groups.push([
      { href: `${entityUrl}/aliases`, label: "View aliases" },
      { href: `${entityUrl}/edit`, label: `Edit ${noun}` },
      { href: `${entityUrl}/merge`, label: `Merge ${noun}` },
    ]);
  }

  if (user?.admin) {
    groups.push([
      {
        disabled: deleteMutation.isPending,
        label: deleteMutation.isPending
          ? `Deleting ${noun}…`
          : `Delete ${noun}`,
        onSelect: () => {
          if (
            !window.confirm(
              `Permanently delete this ${noun}? This cannot be undone.`,
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
                  : `Unable to delete this ${noun}.`,
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
}: {
  children: ReactNode;
  initialEntity: Entity;
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
        heading={`${initialEntity.name} is unavailable`}
        onRetry={() => void entityQuery.refetch()}
      >
        We could not load these details. Try again.
      </SectionError>
    );
  }

  const entity = entityQuery.data;
  const createBottleHref = getEntityBottleCreateHref(entity);
  const canFollow =
    entity.kind === "brand" ||
    entity.kind === "bottler" ||
    entity.kind === "distillery";
  const currentHref = getEntityCurrentHref(entity, pathname);
  const bottleActionLabel = "Add a bottle";

  return (
    <EntityPageContext.Provider value={entity}>
      <div {...stylex.props(styles.page)}>
        <PageHeader
          actions={
            <>
              {canFollow ? (
                <EntityFollowAction key={entity.id} entity={entity} />
              ) : null}
              {createBottleHref ? (
                <ButtonLink
                  href={createBottleHref}
                  size="md"
                  variant={canFollow ? "tonal" : "accent"}
                >
                  {bottleActionLabel}
                </ButtonLink>
              ) : null}
            </>
          }
          actionsPosition="start"
          description={
            entity.description ? (
              <ExpandableDescription content={entity.description} />
            ) : null
          }
          eyebrow={getEntityClassification(entity)}
          menu={<EntityActions entity={entity} />}
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
    </EntityPageContext.Provider>
  );
}

export function useEntityPage() {
  const entity = useContext(EntityPageContext);
  if (!entity) throw new Error("Entity page content requires its route frame");
  return entity;
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  tabs: {
    marginTop: space.x6,
  },
});
