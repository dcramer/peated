"use client";

import type { TagCategory } from "@peated/server/types";
import { BottleList, Button, Slideout } from "@peated/web/components";
import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { useORPC } from "@peated/web/lib/orpc/context";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { CATEGORY_DEFINITIONS, NOTE_DESCRIPTIONS } from "./tastingWheelData";

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
      <p {...stylex.props(foundationStyles.prose, styles.description)}>
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
        <SectionHeading level={3}>
          {selection.note
            ? `More in ${category.name.toLowerCase()}`
            : "Explore the notes"}
        </SectionHeading>
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
        <SectionHeading level={3}>Bottles with these notes</SectionHeading>
        <p {...stylex.props(foundationStyles.body, styles.explanation)}>
          Ordered by how often people mention these notes in their public
          tastings.
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
            <BottleList
              ariaLabel="Bottles with these tasting notes"
              items={query.data.results.map(({ bottle }) =>
                toBottleListItem(bottle),
              )}
            />
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
    textWrap: "pretty",
  },
  categoryDescription: {
    margin: 0,
    color: colors.inkMuted,
    textWrap: "pretty",
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
    textWrap: "pretty",
  },
  status: { marginTop: space.x4, color: colors.inkMuted },
});
