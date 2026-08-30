"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import {
  AppLink,
  Button,
  ButtonLink,
  PageTabs,
  RowMenu,
  SectionError,
  type RowMenuItem,
} from "@peated/web/components/designSystem/components";
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
  const canFollow =
    entity.kind === "brand" ||
    entity.kind === "bottler" ||
    entity.kind === "distillery";
  const presentation = getEntityPresentation(entity);
  const currentHref = getEntityCurrentHref(entity, pathname);
  const bottleActionLabel =
    entity.kind === "distillery" || entity.kind === "bottler"
      ? "Record a bottling"
      : "Add a bottle";

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

        <dl {...stylex.props(styles.figures)}>
          {entity.yearEstablished ? (
            <div {...stylex.props(styles.figure)}>
              <dd {...stylex.props(styles.figureValue)}>
                {entity.yearEstablished}
              </dd>
              <dt {...stylex.props(styles.figureLabel)}>
                {presentation.establishmentLabel.toLowerCase()}
              </dt>
            </div>
          ) : null}
          <div {...stylex.props(styles.figure)}>
            <dd {...stylex.props(styles.figureValue)}>
              {entity.totalBottles.toLocaleString("en-US")}
            </dd>
            <dt {...stylex.props(styles.figureLabel)}>bottles recorded</dt>
          </div>
          <div {...stylex.props(styles.figure)}>
            <dd {...stylex.props(styles.figureValue)}>
              {entity.totalTastings.toLocaleString("en-US")}
            </dd>
            <dt {...stylex.props(styles.figureLabel)}>member tastings</dt>
          </div>
        </dl>
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
  figures: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    margin: 0,
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  figure: {
    minWidth: 0,
    paddingRight: space.x6,
    paddingLeft: {
      default: space.x6,
      "@media (max-width: 559px)": 0,
    },
    paddingTop: {
      default: 0,
      "@media (max-width: 559px)": space.x3,
    },
    paddingBottom: {
      default: 0,
      "@media (max-width: 559px)": space.x3,
    },
    borderLeftWidth: {
      default: "1px",
      "@media (max-width: 559px)": 0,
    },
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    ":first-child": {
      paddingLeft: 0,
      borderLeftWidth: 0,
    },
  },
  figureValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "32px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  figureLabel: {
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "12px",
    lineHeight: 1.35,
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
