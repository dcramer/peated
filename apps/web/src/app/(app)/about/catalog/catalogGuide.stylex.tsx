import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  space,
} from "../../../../styles/tokens.stylex";

const STACKED = "@media (max-width: 699px)";

const recordParts = [
  {
    description: "The stable product name and the exact release people mean.",
    fields: "Name · edition · Peated ID",
    title: "Identity",
  },
  {
    description:
      "Links to the other catalog records that put the whisky in context.",
    fields: "Brand · distillery · bottler · series",
    title: "Connections",
  },
  {
    description:
      "Facts printed on the bottle or supported by another reliable source.",
    fields: "Category · age · ABV · natural color · filtration",
    title: "Label facts",
  },
  {
    description:
      "Separate dates keep the whisky's production and sale history clear.",
    fields: "Distilled · bottled · released",
    title: "Dates",
  },
  {
    description:
      "Details that distinguish a particular cask, batch, or limited release.",
    fields: "Maturation · cask number · outturn",
    title: "Release details",
  },
  {
    description:
      "The useful context added by sources and the people who drank it.",
    fields: "Image · description · ratings · tastings",
    title: "Public record",
  },
] as const;

function MapNode({
  body,
  label,
  placement,
  title,
}: {
  body: string;
  label: string;
  placement: stylex.StyleXStyles;
  title: string;
}) {
  return (
    <div {...stylex.props(styles.mapNode, placement)}>
      <div {...stylex.props(foundationStyles.metadata, styles.mapLabel)}>
        {label}
      </div>
      <h3 {...stylex.props(foundationStyles.rowTitle, styles.mapNodeTitle)}>
        {title}
      </h3>
      <p {...stylex.props(foundationStyles.metadata, styles.mapNodeBody)}>
        {body}
      </p>
    </div>
  );
}

/** Shows the catalog relationships that give one Bottle its public context. */
export function CatalogRecordMap() {
  return (
    <figure {...stylex.props(styles.mapFigure)}>
      <figcaption {...stylex.props(foundationStyles.prose, styles.mapCaption)}>
        A bottle sits at the center. The records around it explain how it was
        sold, who made it, and where it belongs.
      </figcaption>
      <div {...stylex.props(styles.map)}>
        <svg
          aria-hidden="true"
          preserveAspectRatio="none"
          viewBox="0 0 1000 500"
          {...stylex.props(styles.mapLines)}
        >
          <path d="M245 95 L430 210" vectorEffect="non-scaling-stroke" />
          <path d="M755 95 L570 210" vectorEffect="non-scaling-stroke" />
          <path d="M245 405 L430 290" vectorEffect="non-scaling-stroke" />
          <path d="M755 405 L570 290" vectorEffect="non-scaling-stroke" />
        </svg>

        <div {...stylex.props(styles.bottleNode)}>
          <div
            {...stylex.props(foundationStyles.metadata, styles.bottleNodeLabel)}
          >
            The catalog entry
          </div>
          <h3
            {...stylex.props(
              foundationStyles.sectionHeading,
              styles.bottleNodeTitle,
            )}
          >
            Bottle
          </h3>
          <p {...stylex.props(foundationStyles.body, styles.bottleNodeBody)}>
            One marketed whisky release
          </p>
          <p
            {...stylex.props(foundationStyles.metadata, styles.bottleNodeMeta)}
          >
            Ratings, tastings, library entries, and corrections belong here
          </p>
        </div>

        <MapNode
          body="The name the bottle is sold under."
          label="Sold as"
          placement={styles.brandNode}
          title="Brand"
        />
        <MapNode
          body="A named range, when the whisky belongs to one."
          label="Part of"
          placement={styles.seriesNode}
          title="Series"
        />
        <MapNode
          body="The producer or producers that made the whisky."
          label="Made at"
          placement={styles.distilleryNode}
          title="Distillery"
        />
        <MapNode
          body="The independent business that selected and released it, when there is one."
          label="Released by"
          placement={styles.bottlerNode}
          title="Bottler"
        />
      </div>
    </figure>
  );
}

/** Groups Bottle facts by the question each group answers. */
export function BottleRecordAnatomy() {
  return (
    <ul {...stylex.props(styles.recordList)}>
      {recordParts.map((part) => (
        <li key={part.title} {...stylex.props(styles.recordRow)}>
          <h3 {...stylex.props(foundationStyles.compactRowTitle)}>
            {part.title}
          </h3>
          <div
            {...stylex.props(foundationStyles.metadata, styles.recordFields)}
          >
            {part.fields}
          </div>
          <p {...stylex.props(foundationStyles.body, styles.recordDescription)}>
            {part.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

function DecisionList({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div {...stylex.props(styles.decisionColumn)}>
      <h3 {...stylex.props(foundationStyles.rowTitle)}>{title}</h3>
      <ul {...stylex.props(foundationStyles.body, styles.decisionList)}>
        {children}
      </ul>
    </div>
  );
}

/** Contrasts release changes that do and do not create a new Bottle record. */
export function BottleIdentityDecision() {
  return (
    <div {...stylex.props(styles.decisionFrame)}>
      <DecisionList title="A separate bottle record">
        <li>A named edition or marketed batch</li>
        <li>An annual or vintage release</li>
        <li>A separately marketed single cask</li>
      </DecisionList>
      <DecisionList title="The same bottle record">
        <li>Another bottle size</li>
        <li>A gift box or export carton</li>
        <li>Retailer wording or a newer photo</li>
      </DecisionList>
    </div>
  );
}

function RelationshipExample({
  bridge,
  description,
  left,
  right,
  title,
}: {
  bridge: string;
  description: string;
  left: string;
  right: string;
  title: string;
}) {
  return (
    <article {...stylex.props(styles.relationshipExample)}>
      <h3 {...stylex.props(foundationStyles.rowTitle)}>{title}</h3>
      <div {...stylex.props(styles.relationshipFlow)}>
        <div {...stylex.props(foundationStyles.fieldLabel, styles.flowNode)}>
          {left}
        </div>
        <div {...stylex.props(foundationStyles.metadata, styles.flowBridge)}>
          {bridge}
        </div>
        <div {...stylex.props(foundationStyles.fieldLabel, styles.flowNode)}>
          {right}
        </div>
      </div>
      <p {...stylex.props(foundationStyles.body, styles.relationshipBody)}>
        {description}
      </p>
    </article>
  );
}

/** Explains the difference between releases of one product and a wider Series. */
export function BottleRelationships() {
  return (
    <div {...stylex.props(styles.relationshipGrid)}>
      <RelationshipExample
        bridge="same product"
        description="Springbank 12 Cask Strength Batch 23 and Batch 24 are distinct releases of the same product. Shared facts can stay connected without treating the batches as one bottle."
        left="Batch 23"
        right="Batch 24"
        title="Related releases"
      />
      <RelationshipExample
        bridge="same series"
        description="Octomore 13.1 and 13.3 are different products in one wider range. A series provides context; it does not make its bottles the same whisky."
        left="Octomore 13.1"
        right="Octomore 13.3"
        title="One series"
      />
    </div>
  );
}

const certaintyStates = [
  {
    body: "A reliable source states a 12-year age.",
    label: "Known",
    value: "12 years",
  },
  {
    body: "The label was checked and has no age statement.",
    label: "Confirmed",
    value: "No age statement",
  },
  {
    body: "Peated does not have reliable age evidence yet.",
    label: "Unknown",
    value: "Not recorded",
  },
] as const;

/** Distinguishes a known value, a confirmed absence, and an unknown fact. */
export function CatalogCertainty() {
  return (
    <ol {...stylex.props(styles.certaintyList)}>
      {certaintyStates.map((state) => (
        <li key={state.label} {...stylex.props(styles.certaintyItem)}>
          <div
            {...stylex.props(foundationStyles.metadata, styles.certaintyLabel)}
          >
            {state.label}
          </div>
          <div
            {...stylex.props(foundationStyles.rowTitle, styles.certaintyValue)}
          >
            {state.value}
          </div>
          <p {...stylex.props(foundationStyles.body, styles.certaintyBody)}>
            {state.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

const styles = stylex.create({
  mapFigure: {
    margin: 0,
  },
  mapCaption: {
    maxWidth: "680px",
    marginBottom: space.x4,
    color: colors.inkMuted,
  },
  map: {
    position: "relative",
    display: "grid",
    minHeight: "440px",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gridTemplateRows: "repeat(3, minmax(0, 1fr))",
    gap: space.x4,
    boxSizing: "border-box",
    padding: space.x6,
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    [STACKED]: {
      display: "flex",
      minHeight: 0,
      flexDirection: "column",
      gap: space.x2,
      padding: space.x4,
    },
  },
  mapLines: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    color: colors.dataAccent,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2px",
    [STACKED]: {
      display: "none",
    },
  },
  mapNode: {
    position: "relative",
    zIndex: 1,
    boxSizing: "border-box",
    alignSelf: "center",
    padding: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    [STACKED]: {
      width: "100%",
      alignSelf: "stretch",
    },
  },
  mapLabel: {
    color: colors.inkMuted,
  },
  mapNodeTitle: {
    marginTop: space.x1,
  },
  mapNodeBody: {
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
  },
  brandNode: {
    gridColumn: "1",
    gridRow: "1",
  },
  seriesNode: {
    gridColumn: "3",
    gridRow: "1",
  },
  distilleryNode: {
    gridColumn: "1",
    gridRow: "3",
  },
  bottlerNode: {
    gridColumn: "3",
    gridRow: "3",
  },
  bottleNode: {
    position: "relative",
    zIndex: 2,
    gridColumn: "2",
    gridRow: "2",
    alignSelf: "center",
    boxSizing: "border-box",
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.accent,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.accentTint,
    textAlign: "center",
    [STACKED]: {
      order: -1,
      width: "100%",
      marginBottom: space.x2,
    },
  },
  bottleNodeLabel: {
    color: colors.accentDeep,
  },
  bottleNodeTitle: {
    marginTop: space.x1,
  },
  bottleNodeBody: {
    margin: 0,
    marginTop: space.x1,
    color: colors.ink,
  },
  bottleNodeMeta: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  recordList: {
    margin: 0,
    padding: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    listStyle: "none",
  },
  recordRow: {
    display: "grid",
    gridTemplateColumns: "140px minmax(220px, 0.8fr) minmax(0, 1fr)",
    gap: space.x6,
    alignItems: "baseline",
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    [STACKED]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x1,
    },
  },
  recordFields: {
    color: colors.accentDeep,
  },
  recordDescription: {
    margin: 0,
    color: colors.inkMuted,
  },
  decisionFrame: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    [STACKED]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  decisionColumn: {
    padding: space.x6,
    backgroundColor: colors.surface,
    ":first-child": {
      borderRightWidth: "1px",
      borderRightStyle: "solid",
      borderRightColor: colors.sectionRule,
    },
    [STACKED]: {
      padding: space.x4,
      ":first-child": {
        borderRightWidth: 0,
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: colors.sectionRule,
      },
    },
  },
  decisionList: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    margin: 0,
    marginTop: space.x3,
    paddingLeft: "20px",
    color: colors.inkMuted,
  },
  relationshipGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: space.x6,
    [STACKED]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  relationshipExample: {
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  relationshipFlow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 72px minmax(0, 1fr)",
    gap: space.x2,
    alignItems: "center",
    marginTop: space.x4,
  },
  flowNode: {
    boxSizing: "border-box",
    minWidth: 0,
    padding: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    textAlign: "center",
  },
  flowBridge: {
    color: colors.accentDeep,
    textAlign: "center",
  },
  relationshipBody: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  certaintyList: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: controlMetrics.radius,
    listStyle: "none",
    [STACKED]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  certaintyItem: {
    minWidth: 0,
    padding: space.x4,
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: colors.sectionRule,
    ":last-child": {
      borderRightWidth: 0,
    },
    [STACKED]: {
      borderRightWidth: 0,
      borderBottomWidth: "1px",
      borderBottomStyle: "solid",
      borderBottomColor: colors.sectionRule,
      ":last-child": {
        borderBottomWidth: 0,
      },
    },
  },
  certaintyLabel: {
    color: colors.accentDeep,
  },
  certaintyValue: {
    marginTop: space.x1,
  },
  certaintyBody: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
});
