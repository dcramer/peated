"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { TagCategory } from "@peated/server/types";
import { BottleIdentityRow, Button, Slideout } from "@peated/web/components";
import { useORPC } from "@peated/web/lib/orpc/context";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import {
  CATEGORY_DEFINITIONS,
  NOTE_DESCRIPTIONS,
  WHEEL_CATEGORIES,
} from "./tastingWheelData";

type Selection = {
  category: TagCategory;
  note?: keyof typeof NOTE_DESCRIPTIONS;
};
const TastingWheelContext = createContext<{
  selection: Selection | null;
  select: (selection: Selection) => void;
} | null>(null);

export function useTastingWheel() {
  const value = useContext(TastingWheelContext);
  if (!value)
    throw new Error("Tasting wheel controls require TastingWheelProvider.");
  return value;
}

export function TastingWheelProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [open, setOpen] = useState(false);
  function select(next: Selection) {
    setSelection(next);
    setOpen(true);
  }
  const category = selection ? CATEGORY_DEFINITIONS[selection.category] : null;
  return (
    <TastingWheelContext value={{ selection: open ? selection : null, select }}>
      {children}
      <Slideout
        open={open}
        onClose={() => setOpen(false)}
        title={
          selection?.note
            ? titleCase(selection.note)
            : (category?.name ?? "Tasting notes")
        }
        navigation={
          selection?.note ? (
            <Button
              size="sm"
              variant="text"
              onClick={() => select({ category: selection.category })}
            >
              <ArrowLeft size={16} /> {category?.name}
            </Button>
          ) : null
        }
      >
        {selection && category ? (
          <TastingWheelDetails selection={selection} open={open} />
        ) : null}
      </Slideout>
    </TastingWheelContext>
  );
}

export function TastingWheelCategoryLinks() {
  const { select } = useTastingWheel();
  return (
    <div {...stylex.props(styles.categoryLinks)}>
      {WHEEL_CATEGORIES.map((category) => (
        <Button
          key={category.key}
          variant="text"
          align="start"
          fullWidth
          aria-haspopup="dialog"
          onClick={() => select({ category: category.key })}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}

function TastingWheelDetails({
  selection,
  open,
}: {
  selection: Selection;
  open: boolean;
}) {
  const { select } = useTastingWheel();
  const category = CATEGORY_DEFINITIONS[selection.category];
  const orpc = useORPC();
  const query = useQuery(
    orpc.tags.bottles.queryOptions({
      input: selection,
      enabled: open,
      staleTime: 300_000,
    }),
  );
  const notes = [...new Set([...category.wheelNotes, ...category.notes])];
  return (
    <div {...stylex.props(styles.details)}>
      <p {...stylex.props(styles.description)}>
        {selection.note
          ? NOTE_DESCRIPTIONS[selection.note]
          : category.description}
      </p>
      {selection.note ? (
        <p {...stylex.props(styles.categoryDescription)}>
          <strong>{category.name}:</strong> {category.description}
        </p>
      ) : null}
      <section>
        <h3 {...stylex.props(styles.heading)}>
          {selection.note
            ? `More in ${category.name.toLowerCase()}`
            : "Explore the notes"}
        </h3>
        <div {...stylex.props(styles.notes)}>
          {notes.map((note) => (
            <Button
              key={note}
              size="sm"
              variant={selection.note === note ? "accent" : "tonal"}
              aria-pressed={selection.note === note}
              onClick={() => select({ category: selection.category, note })}
            >
              {note}
            </Button>
          ))}
        </div>
      </section>
      <section aria-busy={query.isPending}>
        <h3 {...stylex.props(styles.heading)}>Bottles across Peated</h3>
        <p {...stylex.props(styles.explanation)}>
          Ranked by the share of public tastings with notes that mention{" "}
          {selection.note
            ? selection.note
            : `a note in the ${category.name.toLowerCase()} category`}
          .
        </p>
        <div aria-live="polite">
          {query.isPending ? (
            <p {...stylex.props(styles.status)}>Finding bottles…</p>
          ) : query.isError ? (
            <div {...stylex.props(styles.status)} role="alert">
              <p>We couldn’t load bottle examples.</p>
              <Button onClick={() => query.refetch()} variant="tonal">
                Try again
              </Button>
            </div>
          ) : query.data.results.length ? (
            <ul {...stylex.props(styles.bottles)}>
              {query.data.results.map(
                ({ bottle, matchingTastings, taggedTastings }) => (
                  <li key={bottle.id} {...stylex.props(styles.bottle)}>
                    <BottleIdentityRow
                      name={formatBottleDisplayName(bottle, {
                        includeBrand: false,
                      })}
                      brand={bottle.brand.name}
                      href={`/bottles/${bottle.id}`}
                      imageUrl={bottle.imageUrl}
                      subtitle={`${matchingTastings.toLocaleString()} of ${taggedTastings.toLocaleString()} ${taggedTastings === 1 ? "tasting" : "tastings"}`}
                      metadata={[...(bottle.abv ? [`${bottle.abv}% ABV`] : [])]}
                    />
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p {...stylex.props(styles.status)}>
              No bottles have recorded tastings for{" "}
              {selection.note ?? `this category`} yet. Try another note.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = stylex.create({
  details: { display: "flex", flexDirection: "column", gap: space.x6 },
  description: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.6,
    textWrap: "pretty",
  },
  categoryDescription: {
    margin: 0,
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  heading: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  notes: {
    display: "flex",
    flexWrap: "wrap",
    gap: space.x2,
    marginTop: space.x3,
  },
  explanation: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontSize: "14px",
    textWrap: "pretty",
  },
  status: { marginTop: space.x4, color: colors.inkMuted },
  bottles: { margin: 0, marginTop: space.x3, padding: 0, listStyle: "none" },
  bottle: {
    borderBottom: {
      default: `1px solid ${colors.hairline}`,
      ":last-child": "none",
    },
  },
  categoryLinks: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    marginLeft: "-16px",
  },
});
