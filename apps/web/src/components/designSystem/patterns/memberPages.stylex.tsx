"use client";

import * as stylex from "@stylexjs/stylex";
import { LockKeyhole, UserPlus } from "lucide-react";
import { useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  BandMark,
  Button,
  FacetRow,
  ListToolbar,
  PageTabs,
  Pager,
  Passport,
  PeriodHeader,
  RowMenu,
  Score,
  SummaryStrip,
  TastingEntry,
} from "../components";
import {
  Avatar,
  BottleThumbnail,
  MeasurePanel,
  PageColumns,
  PageHeader,
  PagePatternShell,
  PageSection,
  Panel,
  RailSection,
  RecordList,
  RecordRow,
} from "./pagePatternShell.stylex";

const sortOptions = [
  { label: "Recently added", value: "recent" },
  { label: "Bottle name", value: "name" },
  { label: "Score", value: "score" },
] as const;

const libraryRows = [
  ["Lagavulin 16-year-old", "Islay · 16 years · 43% ABV", "outstanding"],
  ["Ardbeg Uigeadail", "Islay · NAS · 54.2% ABV", "outstanding"],
  ["Springbank 10-year-old", "Campbeltown · 10 years · 46% ABV", "very_good"],
  ["Redbreast 12-year-old", "Ireland · 12 years · 40% ABV", "very_good"],
] as const;

export function LibraryPagePattern() {
  const [sort, setSort] = useState("recent");

  return (
    <PagePatternShell currentHref="/library">
      <PageHeader
        actions={<Button variant="tonal">Add a bottle</Button>}
        description="The bottles you keep, organized by the fields already owned by each record."
        eyebrow="Your record"
        title="Library"
      />
      <div {...stylex.props(styles.summary)}>
        <SummaryStrip
          cells={[
            { label: "Bottles", value: 41 },
            { label: "Distilleries", value: 27 },
            { label: "Regions", value: 8 },
            { detail: "5 unopened", label: "This year", value: 14 },
          ]}
        />
      </div>
      <PageColumns rail={<LibraryFacets />}>
        <ListToolbar
          count={41}
          noun="bottle"
          onExport={() => undefined}
          onSortChange={setSort}
          sort={sort}
          sortOptions={sortOptions}
        />
        <RecordList ariaLabel="Bottles in your library">
          {libraryRows.map(([title, metadata, ratingBand]) => (
            <RecordRow
              action={
                <RowMenu
                  groups={[
                    [
                      { label: "Log a tasting", onSelect: () => undefined },
                      {
                        label: "Remove from library",
                        onSelect: () => undefined,
                      },
                    ],
                  ]}
                  label={title}
                />
              }
              end={<BandMark band={ratingBand} />}
              href="#"
              key={title}
              leading={<BottleThumbnail label={`${title} bottle`} />}
              metadata={metadata}
              title={title}
            />
          ))}
        </RecordList>
        <div {...stylex.props(styles.pager)}>
          <Pager
            currentPage={1}
            filterLabel="all bottles"
            getPageHref={(page) => `#page-${page}`}
            rangeEnd={20}
            rangeStart={1}
            totalCount={41}
            totalPages={3}
          />
        </div>
      </PageColumns>
    </PagePatternShell>
  );
}

function LibraryFacets() {
  return (
    <>
      <RailSection heading="Region">
        <FacetRow count={12} label="Islay" total={41} />
        <FacetRow count={8} label="Speyside" total={41} />
        <FacetRow count={6} label="Highlands" total={41} />
      </RailSection>
      <RailSection heading="Age statement">
        <FacetRow count={9} label="No age statement" total={41} />
        <FacetRow count={13} label="12–17 years" total={41} />
        <FacetRow count={5} label="18–24 years" total={41} />
      </RailSection>
      <RailSection heading="Your tasting rating">
        <FacetRow count={4} label="Unicorn" total={41} />
        <FacetRow count={11} label="Outstanding" total={41} />
        <FacetRow count={17} label="Very good" total={41} />
        <FacetRow count={7} label="Good" total={41} />
        <FacetRow count={2} label="Mediocre" total={41} />
      </RailSection>
    </>
  );
}

export function TastingsPagePattern() {
  return (
    <PagePatternShell currentHref="/tastings">
      <PageHeader
        actions={<Button variant="accent">Log a tasting</Button>}
        description="Your tasting record, ordered by when each pour happened. A shared sitting stays one entry."
        eyebrow="Your record"
        title="Tastings"
      />
      <div {...stylex.props(styles.summary)}>
        <SummaryStrip
          cells={[
            { label: "Tastings", value: 412 },
            { label: "Bottles", value: 286 },
            { label: "Distilleries", value: 94 },
            { detail: "31 this year", label: "Sittings", value: 178 },
          ]}
        />
      </div>
      <PageColumns
        rail={
          <>
            <RailSection heading="Period">
              <FacetRow count={31} label="2026" total={412} />
              <FacetRow count={84} label="2025" total={412} />
              <FacetRow count={103} label="2024" total={412} />
            </RailSection>
            <RailSection heading="Tasting rating">
              <FacetRow count={28} label="Unicorn" total={412} />
              <FacetRow count={116} label="Outstanding" total={412} />
              <FacetRow count={164} label="Very good" total={412} />
              <FacetRow count={79} label="Good" total={412} />
              <FacetRow count={25} label="Mediocre" total={412} />
            </RailSection>
          </>
        }
      >
        <PeriodHeader>This week</PeriodHeader>
        <TastingEntry
          author="You"
          comment="A useful comparison: the sherry cask amplified the smoke rather than softening it."
          context="At home with Mara and Alex"
          date="August 24, 2026"
          leading={<Avatar initials="DC" />}
          members={[
            {
              href: "#",
              metadata: "Islay · 16 years · 43% ABV",
              name: "Lagavulin 16-year-old",
              notes: ["Smoke", "Dried fruit", "Sea salt"],
              ratingBand: "outstanding",
            },
            {
              href: "#",
              metadata: "Islay · NAS · 54.2% ABV",
              name: "Ardbeg Uigeadail",
              notes: ["Tar", "Raisin", "Espresso"],
              ratingBand: "good",
            },
          ]}
          menu={
            <RowMenu
              groups={[[{ label: "Edit sitting", onSelect: () => undefined }]]}
              label="August 24 tasting"
            />
          }
        />
        <TastingEntry
          author="You"
          date="August 21, 2026"
          leading={<Avatar initials="DC" />}
          members={[
            {
              href: "#",
              metadata: "Campbeltown · 10 years · 46% ABV",
              name: "Springbank 10-year-old",
              notes: ["Mineral", "Wax", "Pear"],
              ratingBand: "outstanding",
            },
          ]}
        />
        <PeriodHeader>Earlier in August</PeriodHeader>
        <TastingEntry
          author="You"
          date="August 9, 2026"
          leading={<Avatar initials="DC" />}
          members={[
            {
              href: "#",
              metadata: "Ireland · 12 years · 40% ABV",
              name: "Redbreast 12-year-old",
              notes: ["Orchard fruit", "Spice"],
              ratingBand: "very_good",
            },
          ]}
        />
      </PageColumns>
    </PagePatternShell>
  );
}

export type ProfileState = "private" | "someone-else" | "you";

export function ProfilePagePattern({
  state = "someone-else",
}: {
  state?: ProfileState;
}) {
  const isYou = state === "you";
  const isPrivate = state === "private";

  return (
    <PagePatternShell currentHref="/friends">
      <PageHeader
        actions={
          isYou ? (
            <Button variant="tonal">Edit profile</Button>
          ) : (
            <Button variant={isPrivate ? "tonal" : "accent"}>
              <UserPlus aria-hidden="true" size={16} />
              {isPrivate ? "Ask to follow" : "Follow"}
            </Button>
          )
        }
        description={
          isPrivate
            ? "This member keeps their profile private. Their name and membership date remain public."
            : "Exploring peated whisky, old blends, and distilleries with long production histories."
        }
        eyebrow={isPrivate ? "Private profile" : "Member since 2018"}
        identity={<Avatar initials={isYou ? "DC" : "MB"} />}
        title={isYou ? "David Cramer" : "Mara Bell"}
      />
      {isPrivate ? (
        <div {...stylex.props(styles.privateGate)}>
          <LockKeyhole aria-hidden="true" size={24} />
          <div>
            <h2 {...stylex.props(foundationStyles.sectionHeading)}>
              Their record is private
            </h2>
            <p {...stylex.props(styles.privateCopy)}>
              Follow requests let the member decide who can see their tastings
              and library.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div {...stylex.props(styles.summary)}>
            <SummaryStrip
              cells={[
                { label: "Tastings", value: isYou ? 412 : 187 },
                { label: "Bottles recorded", value: isYou ? 64 : 23 },
                { label: "Distilleries", value: isYou ? 94 : 51 },
                { label: "Friends", value: isYou ? 38 : 74 },
              ]}
            />
          </div>
          <PageTabs
            ariaLabel="Member pages"
            currentHref="#tastings"
            items={[
              {
                count: isYou ? 412 : 187,
                href: "#tastings",
                label: "Tastings",
              },
              { count: isYou ? 41 : 32, href: "#library", label: "Library" },
              { href: "#passports", label: "Passports" },
            ]}
          />
          <PageColumns
            rail={
              <>
                <MeasurePanel label="Review score">
                  <Score
                    count={isYou ? 208 : 94}
                    high={97}
                    low={72}
                    median={90}
                  />
                </MeasurePanel>
                <RailSection heading="Passports">
                  <Passport
                    count={9}
                    kind="open"
                    nextStampIn={2}
                    unit="distilleries"
                  />
                </RailSection>
                {isYou ? (
                  <RailSection heading="2026 so far">
                    <Panel>
                      <div {...stylex.props(styles.yearFigure)}>31</div>
                      <div {...stylex.props(styles.yearLabel)}>
                        tastings across 22 bottles
                      </div>
                    </Panel>
                  </RailSection>
                ) : null}
              </>
            }
          >
            <PageSection count={isYou ? 412 : 187} heading="Tastings">
              <TastingEntry
                author={isYou ? "You" : "Mara Bell"}
                date="August 22, 2026"
                leading={<Avatar initials={isYou ? "DC" : "MB"} />}
                members={[
                  {
                    metadata: "Islay · 16 years · 43% ABV",
                    name: "Lagavulin 16-year-old",
                    notes: ["Smoke", "Orange", "Chocolate"],
                    ratingBand: "outstanding",
                  },
                ]}
              />
              <TastingEntry
                author={isYou ? "You" : "Mara Bell"}
                context="Bottle share"
                date="August 16, 2026"
                leading={<Avatar initials={isYou ? "DC" : "MB"} />}
                members={[
                  {
                    name: "Springbank 10-year-old",
                    ratingBand: "outstanding",
                  },
                  { name: "Kilkerran 12-year-old", ratingBand: "very_good" },
                ]}
              />
            </PageSection>
          </PageColumns>
        </>
      )}
    </PagePatternShell>
  );
}

const styles = stylex.create({
  summary: {
    marginTop: "6px",
    marginBottom: space.x8,
  },
  pager: {
    marginTop: space.x6,
  },
  privateGate: {
    display: "flex",
    maxWidth: "760px",
    alignItems: "flex-start",
    gap: space.x4,
    marginTop: space.x8,
    padding: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  privateCopy: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  yearFigure: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "32px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  yearLabel: {
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  railLink: {
    marginTop: space.x3,
  },
});
