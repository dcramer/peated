"use client";

import * as stylex from "@stylexjs/stylex";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  Button,
  Chip,
  CommunityScore,
  CriticReview,
  FacetRow,
  FactList,
  IdStamp,
  PageTabs,
  Passport,
  RailList,
  RailListItem,
  RecordTable,
  RowMenu,
  ScopedSearch,
  SpecStrip,
  TastingEntry,
  VerdictDistribution,
  VerdictDistributionBar,
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
  TextLink,
} from "./pagePatternShell.stylex";

const MOBILE = "@media (max-width: 559px)";

const recordMenuGroups = [
  {
    items: [
      { label: "Edit record", onSelect: () => undefined },
      { label: "View changes", onSelect: () => undefined },
    ],
  },
  {
    items: [
      { label: "Merge duplicate", onSelect: () => undefined },
      { label: "Remove record", onSelect: () => undefined },
    ],
    label: "Moderator",
  },
] as const;

const bottleRows = [
  {
    href: "/bottles/lagavulin-16",
    id: "B00872",
    metadata: "Islay · 16 years · 43% ABV",
    name: "Lagavulin 16-year-old",
    values: [
      91,
      <VerdictDistributionBar key="v1" pass={12} savor={142} sip={46} />,
    ],
  },
  {
    href: "/bottles/lagavulin-12-cask-strength",
    id: "B02141",
    metadata: "Islay · 12 years · 56.5% ABV",
    name: "Lagavulin 12-year-old Cask Strength",
    values: [
      93,
      <VerdictDistributionBar key="v2" pass={4} savor={88} sip={23} />,
    ],
  },
  {
    href: "/bottles/lagavulin-8",
    id: "B04198",
    metadata: "Islay · 8 years · 48% ABV",
    name: "Lagavulin 8-year-old",
    values: [
      89,
      <VerdictDistributionBar key="v3" pass={8} savor={61} sip={31} />,
    ],
  },
] as const;

export function BottlePagePattern() {
  return (
    <PagePatternShell currentHref="/bottles">
      <PageColumns
        rail={
          <>
            <MeasurePanel label="Community score">
              <CommunityScore count={184} score={91.2} />
            </MeasurePanel>
            <MeasurePanel label="Community verdict">
              <VerdictDistribution pass={12} savor={142} sip={46} />
            </MeasurePanel>
            <RailSection heading="Declared on the label">
              <Panel>
                <FactList
                  facts={[
                    { label: "Colouring", value: "Natural" },
                    { label: "Filtration", value: "Chill-filtered" },
                    { label: "Cask", value: "Oak" },
                    { label: "Bottling", value: "Official" },
                  ]}
                />
              </Panel>
            </RailSection>
            <RailSection heading="From the same distillery">
              <RailList ariaLabel="Other Lagavulin bottles">
                <RailListItem
                  end="93"
                  metadata="12 years · 56.5%"
                  title="Cask Strength"
                />
                <RailListItem
                  end="89"
                  metadata="8 years · 48%"
                  title="8-year-old"
                />
                <RailListItem
                  end="90"
                  metadata="NAS · 54.2%"
                  title="Distillers Edition"
                />
              </RailList>
            </RailSection>
          </>
        }
      >
        <PageHeader
          actions={
            <>
              <Button variant="accent">Log a tasting</Button>
              <Button variant="tonal">Add to library</Button>
            </>
          }
          description="A benchmark Islay single malt matured for sixteen years, balancing dense peat smoke with dried fruit and maritime salinity."
          eyebrow="Islay · single malt"
          identity={<IdStamp detail="Islay · single malt" id="B00872" />}
          menu={
            <RowMenu groups={recordMenuGroups} label="Lagavulin 16-year-old" />
          }
          parent="Lagavulin"
          title="Lagavulin 16-year-old"
        />
        <div {...stylex.props(styles.chips)}>
          <Chip variant="tinted">Smoke</Chip>
          <Chip variant="tinted">Dried fruit</Chip>
          <Chip variant="tinted">Sea salt</Chip>
        </div>
        <SpecStrip
          cells={[
            { label: "Age", value: "16 years" },
            { label: "ABV", value: "43%" },
            { label: "Cask", value: "Oak" },
            { label: "Release", value: "Core range" },
          ]}
        />
        <PageSection count={3} heading="Critic reviews">
          <CriticReview
            href="#"
            publication="Whisky Advocate"
            score={{ display: "92/100", scale: 100, value: 92 }}
            summary="A standard-setter: smoky, rich, and composed."
          />
          <CriticReview
            href="#"
            publication="Malt Review"
            score={{ display: "8/10", scale: 10, value: 8 }}
            summary="The classic southern Islay profile, with fruit beneath the smoke."
          />
          <CriticReview
            href="#"
            publication="The Whisky Wash"
            score={{ display: "4.5/5", scale: 5, value: 4.5 }}
          />
        </PageSection>
        <PageSection count={200} heading="Tastings">
          <PageTabs
            ariaLabel="Tasting audience"
            currentHref="#community"
            items={[
              { count: 12, href: "#friends", label: "Friends" },
              { count: 200, href: "#community", label: "Community" },
            ]}
          />
          <TastingEntry
            author="Mara Bell"
            comment="The smoke arrives first, then orange peel and dark chocolate."
            date="August 22, 2026"
            leading={<Avatar initials="MB" />}
            members={[
              {
                metadata: "Neat · 30 ml",
                name: "Lagavulin 16-year-old",
                notes: ["Smoke", "Orange", "Chocolate"],
                verdict: "savor",
              },
            ]}
          />
          <TastingEntry
            author="Alex Chen"
            context="Islay tasting"
            date="August 18, 2026"
            leading={<Avatar initials="AC" />}
            members={[
              {
                name: "Lagavulin 16-year-old",
                notes: ["Sea salt", "Raisin"],
                score: 91,
              },
              {
                name: "Ardbeg Uigeadail",
                notes: ["Tar", "Espresso"],
                score: 93,
              },
            ]}
          />
        </PageSection>
      </PageColumns>
    </PagePatternShell>
  );
}

type EntityKind = "brand" | "bottler" | "corporation" | "distillery" | "series";

type EntityData = {
  detail: string;
  description: string;
  eyebrow: string;
  id: string;
  parent: string | undefined;
  title: string;
};

const entityData = {
  distillery: {
    detail: "Distillery · operating",
    description:
      "An Islay distillery founded beside Dunyvaig Castle and known for long fermentation and a deeply peated house style.",
    eyebrow: "Diageo · Islay",
    id: "D01124",
    parent: "Owned by Diageo",
    title: "Lagavulin",
  },
  bottler: {
    detail: "Bottler · independent",
    description:
      "An independent bottler focused on single-cask and small-batch releases from across Scotland.",
    eyebrow: "Edinburgh · Scotland",
    id: "N00418",
    parent: undefined,
    title: "Càrn Mòr",
  },
  brand: {
    detail: "Brand",
    description:
      "A flat label record covering the official Lagavulin releases currently in the database.",
    eyebrow: "Single malt brand",
    id: "N00091",
    parent: "Issued by Diageo",
    title: "Lagavulin",
  },
  series: {
    detail: "Series",
    description:
      "The annual cask-strength releases that show Lagavulin at a younger age and natural strength.",
    eyebrow: "Annual release",
    id: "S00114",
    parent: "Lagavulin",
    title: "12-year-old Cask Strength",
  },
  corporation: {
    detail: "Corporation",
    description:
      "A spirits company whose whisky portfolio includes distilleries and brands across Scotland.",
    eyebrow: "Owner · United Kingdom",
    id: "C00012",
    parent: undefined,
    title: "Diageo",
  },
} satisfies Record<EntityKind, EntityData>;

export function EntityPagePattern({
  kind = "distillery",
}: {
  kind?: EntityKind;
}) {
  const entity = entityData[kind];

  return (
    <PagePatternShell
      currentHref={kind === "bottler" ? "/bottlers" : "/distillers"}
    >
      <PageColumns
        rail={
          <>
            <MeasurePanel label="Community score">
              <CommunityScore count={624} score={90.4} />
            </MeasurePanel>
            <MeasurePanel label="Community verdict">
              <VerdictDistribution pass={44} savor={431} sip={149} />
            </MeasurePanel>
            <RailSection heading="Coverage">
              <Passport
                count={9}
                kind="open"
                nextStampIn={2}
                unit="bottlings"
              />
            </RailSection>
          </>
        }
      >
        <PageHeader
          actions={
            <>
              <Button variant="accent">Follow</Button>
              <Button variant="tonal">Record a bottling</Button>
            </>
          }
          description={entity.description}
          eyebrow={entity.eyebrow}
          identity={<IdStamp detail={entity.detail} id={entity.id} />}
          menu={<RowMenu groups={recordMenuGroups} label={entity.title} />}
          parent={entity.parent}
          title={entity.title}
        />
        <SpecStrip
          cells={[
            { label: "Founded", value: kind === "distillery" ? 1816 : "–" },
            { label: "Country", value: "Scotland" },
            { label: "Bottlings", value: 312 },
            { label: "Status", value: "Active" },
          ]}
        />
        <PageSection
          count={3}
          heading={kind === "corporation" ? "Distilleries" : "Bottlings"}
        >
          <RecordTable
            columns={["Score", "Verdict"]}
            detail="Core range"
            heading={kind === "corporation" ? "Islay" : "Core range"}
            rows={bottleRows}
          />
        </PageSection>
        <PageSection
          count={2}
          heading={kind === "brand" ? "Series" : "Annual & limited"}
        >
          <RecordTable
            columns={["Score", "Verdict"]}
            heading={kind === "brand" ? "Related series" : "Annual & limited"}
            rows={[bottleRows[1], bottleRows[2]]}
          />
        </PageSection>
      </PageColumns>
    </PagePatternShell>
  );
}

export function RegionPagePattern() {
  return (
    <PagePatternShell currentHref="/distillers">
      <PageColumns
        rail={
          <>
            <RailSection heading="Your Islay passport">
              <Passport
                kind="closed"
                stamps={[
                  { label: "Ardbeg", stamped: true },
                  { label: "Bowmore", stamped: true },
                  { label: "Bruichladdich", stamped: false },
                  { label: "Bunnahabhain", stamped: false },
                  { label: "Caol Ila", stamped: true },
                  { label: "Kilchoman", stamped: false },
                  { label: "Lagavulin", stamped: true },
                  { label: "Laphroaig", stamped: false },
                  { label: "Port Ellen", stamped: false },
                ]}
                unit="distilleries"
              />
            </RailSection>
            <RailSection heading="Other regions">
              <RailList ariaLabel="Other whisky regions">
                <RailListItem end="54" title="Speyside" />
                <RailListItem end="33" title="Highlands" />
                <RailListItem end="5" title="Campbeltown" />
              </RailList>
            </RailSection>
          </>
        }
      >
        <PageHeader
          actions={<Button variant="tonal">Open in map</Button>}
          description="A small island off Scotland’s west coast whose distilleries are associated with maritime, smoky single malts."
          eyebrow="Scotland · Inner Hebrides"
          parent="Scotland"
          title="Islay"
        />
        <SpecStrip
          cells={[
            { label: "Working", value: 9 },
            { label: "Silent", value: 4 },
            { label: "Bottlings", value: "4,218" },
            { label: "Your pours", value: 4 },
          ]}
        />
        <PageSection count={9} heading="Working distilleries">
          <RecordList ariaLabel="Working Islay distilleries">
            {[
              [
                "Ardbeg",
                "D00041",
                "Port Ellen · founded 1815",
                "312 bottlings",
              ],
              [
                "Lagavulin",
                "D01124",
                "Port Ellen · founded 1816",
                "284 bottlings",
              ],
              [
                "Laphroaig",
                "D01131",
                "Port Ellen · founded 1815",
                "398 bottlings",
              ],
              [
                "Bruichladdich",
                "D00217",
                "Rhinns · founded 1881",
                "521 bottlings",
              ],
            ].map(([title, id, metadata, end]) => (
              <RecordRow
                end={end}
                href="#"
                key={id}
                metadata={`${id} · ${metadata}`}
                title={title}
              />
            ))}
          </RecordList>
        </PageSection>
        <PageSection count={4} heading="Silent distilleries">
          <RecordList ariaLabel="Silent Islay distilleries">
            <RecordRow
              end="67 bottlings"
              metadata="D01732 · silent since 1983"
              title="Port Ellen"
            />
            <RecordRow
              end="14 bottlings"
              metadata="D01361 · silent since 1929"
              title="Malt Mill"
            />
          </RecordList>
        </PageSection>
      </PageColumns>
    </PagePatternShell>
  );
}

const searchScopes = [
  { label: "Everything", value: "all" },
  { label: "Bottles", value: "bottles" },
  { label: "Distillers", value: "distillers" },
] as const;

export function SearchPagePattern() {
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("Lagavulin");

  return (
    <PagePatternShell currentHref="/bottles">
      <PageHeader
        description="Search the complete database, then narrow the result set with fields owned by each record."
        eyebrow="Database"
        title="Search"
      />
      <div {...stylex.props(styles.searchField)}>
        <ScopedSearch
          aria-label="Search database"
          onChange={(event) => setQuery(event.currentTarget.value)}
          onScopeChange={setScope}
          scope={scope}
          scopes={searchScopes}
          value={query}
        />
      </div>
      <PageColumns
        rail={
          <>
            <RailSection heading="Region">
              <FacetRow count={642} label="Islay" total={1832} />
              <FacetRow count={488} label="Speyside" total={1832} />
              <FacetRow count={319} label="Highlands" total={1832} />
            </RailSection>
            <RailSection heading="Age">
              <FacetRow count={518} label="No age statement" total={1832} />
              <FacetRow count={392} label="12–17 years" total={1832} />
              <FacetRow count={164} label="18–24 years" total={1832} />
            </RailSection>
          </>
        }
      >
        <PageSection count={1832} heading={`Results for “${query}”`}>
          <RecordTable
            columns={["Score", "Verdict"]}
            detail="Bottles matching the current scope and facets"
            heading="Bottles"
            rows={bottleRows}
          />
          <div {...stylex.props(styles.resultHandoff)}>
            <TextLink href="#table">
              Compare all 1,832 bottles in the table →
            </TextLink>
          </div>
        </PageSection>
        <PageSection count={2} heading="Distillers">
          <RecordList ariaLabel="Matching distillers">
            <RecordRow
              end="312 bottlings"
              metadata="D01124 · Islay"
              title="Lagavulin"
            />
            <RecordRow
              end="521 bottlings"
              metadata="D00217 · Islay"
              title="Bruichladdich"
            />
          </RecordList>
        </PageSection>
      </PageColumns>
    </PagePatternShell>
  );
}

export function MapPagePattern() {
  return (
    <PagePatternShell currentHref="/map" footer={false}>
      <PageHeader
        description="Distilleries with recorded coordinates. A ring marks places already represented in your tastings."
        eyebrow="Geography"
        title="Distillery map"
      />
      <PageTabs
        ariaLabel="Map filters"
        currentHref="#all"
        items={[
          { href: "#all", label: "All" },
          { href: "#working", label: "Working" },
          { href: "#silent", label: "Silent" },
          { href: "#poured", label: "Poured by you" },
        ]}
      />
      <div {...stylex.props(styles.mapLayout)}>
        <div
          aria-label="Map of Scottish distilleries"
          role="img"
          {...stylex.props(styles.mapViewport)}
        >
          <div {...stylex.props(styles.mapLand, styles.mapLandMainland)} />
          <div {...stylex.props(styles.mapLand, styles.mapLandIslay)} />
          {[
            ["Lagavulin", "22%", "68%", true],
            ["Ardbeg", "30%", "72%", true],
            ["Bowmore", "14%", "55%", false],
            ["Macallan", "66%", "33%", true],
            ["GlenDronach", "76%", "25%", false],
          ].map(([label, left, top, poured]) => (
            <span
              aria-label={`${label}${poured ? ", poured by you" : ""}`}
              key={String(label)}
              title={String(label)}
              {...stylex.props(styles.pin, poured === true && styles.pouredPin)}
              style={{ left: String(left), top: String(top) }}
            >
              <MapPin aria-hidden="true" size={22} />
            </span>
          ))}
          <div {...stylex.props(styles.mapCaption)}>
            Scotland · 192 places in view
          </div>
        </div>
        <aside {...stylex.props(styles.mapRail)}>
          <RailSection heading="In view · Islay">
            <RailList ariaLabel="Islay distilleries in map view">
              <RailListItem end="Poured" metadata="Working" title="Ardbeg" />
              <RailListItem end="Poured" metadata="Working" title="Lagavulin" />
              <RailListItem metadata="Working" title="Bowmore" />
            </RailList>
          </RailSection>
          <RailSection heading="In view · Speyside">
            <RailList ariaLabel="Speyside distilleries in map view">
              <RailListItem end="Poured" metadata="Working" title="Macallan" />
              <RailListItem metadata="Working" title="Glenfarclas" />
            </RailList>
          </RailSection>
        </aside>
      </div>
    </PagePatternShell>
  );
}

const styles = stylex.create({
  chips: {
    display: "flex",
    gap: space.x2,
    marginTop: space.x3,
    marginBottom: space.x3,
    flexWrap: "wrap",
  },
  searchField: {
    maxWidth: "760px",
    marginTop: space.x4,
  },
  resultHandoff: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: space.x2,
  },
  mapLayout: {
    display: "grid",
    minHeight: "620px",
    gridTemplateColumns: "minmax(0, 1fr) 336px",
    gap: space.x4,
    marginTop: space.x4,
    [MOBILE]: {
      minHeight: "auto",
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  mapViewport: {
    position: "relative",
    minHeight: "620px",
    overflow: "hidden",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    [MOBILE]: {
      minHeight: "440px",
    },
  },
  mapLand: {
    position: "absolute",
    backgroundColor: colors.surface,
    boxShadow: `inset 0 0 0 1px ${colors.hairline}`,
  },
  mapLandMainland: {
    top: "-8%",
    right: "10%",
    width: "54%",
    height: "112%",
    borderRadius: "42% 58% 55% 45% / 36% 43% 57% 64%",
    transform: "rotate(-9deg)",
  },
  mapLandIslay: {
    top: "46%",
    left: "15%",
    width: "17%",
    height: "25%",
    borderRadius: "60% 40% 55% 45%",
    transform: "rotate(18deg)",
  },
  pin: {
    position: "absolute",
    zIndex: 2,
    display: "inline-flex",
    width: "32px",
    height: "32px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    backgroundColor: colors.ground,
    color: colors.inkMuted,
  },
  pouredPin: {
    color: colors.accent,
    boxShadow: `inset 0 0 0 2px ${colors.accent}`,
  },
  mapCaption: {
    position: "absolute",
    bottom: space.x4,
    left: space.x4,
    zIndex: 2,
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x2,
    paddingLeft: space.x3,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.ground,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
  },
  mapRail: {
    display: "flex",
    flexDirection: "column",
    gap: space.x6,
    [MOBILE]: {
      display: "none",
    },
  },
});
