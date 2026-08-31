"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import {
  AppLink,
  Button,
  ButtonLink,
  KeyFacts,
  PageTabs,
  RowMenu,
  SectionError,
  type RowMenuItem,
} from "@peated/web/components";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import Markdown from "@peated/web/components/markdown";
import useAuth from "@peated/web/hooks/useAuth";
import useEntityFollowing from "@peated/web/hooks/useEntityFollowing";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { logTelemetryError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { foundationStyles } from "@peated/web/styles/foundations.stylex";
import {
  colors,
  effects,
  fonts,
  space,
} from "../../../../styles/tokens.stylex";

import {
  getEntityClassification,
  getEntityCurrentHref,
  getEntityOwnerLabel,
  getEntityPresentation,
  getEntityTabs,
  type Entity,
} from "./entityPageData";

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
  const pending = followControls.pendingId === entity.id;

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
      { href: `/entities/${entity.id}/aliases`, label: "View aliases" },
      { href: `/entities/${entity.id}/edit`, label: `Edit ${noun}` },
      { href: `/entities/${entity.id}/merge`, label: `Merge ${noun}` },
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
  const presentation = getEntityPresentation(entity);
  const currentHref = getEntityCurrentHref(entity, pathname);
  const bottleActionLabel = "Add a bottle";

  return (
    <div {...stylex.props(styles.page)}>
      <header>
        <div {...stylex.props(styles.masthead)}>
          <div {...stylex.props(styles.classification)}>
            {getEntityClassification(entity)}
          </div>
          <h1 {...stylex.props(foundationStyles.pageTitle, styles.title)}>
            {entity.name}
          </h1>
        </div>

        <div {...stylex.props(styles.summary)}>
          {owner ? (
            <AppLink
              href={getEntityUrl(owner)}
              {...stylex.props(styles.ownerLink)}
            >
              {getEntityOwnerLabel(entity, owner)}
            </AppLink>
          ) : null}
          {entity.description ? (
            <div {...stylex.props(styles.description)}>
              <Markdown content={entity.description} />
            </div>
          ) : null}
          <div {...stylex.props(styles.headerActions)}>
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
            <EntityActions entity={entity} />
          </div>
        </div>

        <div {...stylex.props(styles.specs)}>
          <KeyFacts
            facts={[
              {
                label: presentation.establishmentLabel,
                value: entity.yearEstablished,
              },
              {
                label: "Bottles recorded",
                value: entity.totalBottles.toLocaleString("en-US"),
              },
              {
                label: "Member tastings",
                value: entity.totalTastings.toLocaleString("en-US"),
              },
            ]}
          />
        </div>
      </header>

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
    marginTop: 0,
  },
  masthead: {
    paddingTop: space.x3,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  classification: {
    marginBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  title: {
    fontSize: "clamp(44px, 6vw, 72px)",
    letterSpacing: "-0.05em",
    lineHeight: 0.95,
  },
  summary: {
    display: "flex",
    maxWidth: "66ch",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space.x3,
    paddingTop: space.x6,
    paddingBottom: space.x6,
  },
  description: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  specs: {
    marginBottom: space.x4,
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
