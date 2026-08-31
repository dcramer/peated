"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { safe } from "@orpc/client";
import { toTitleCase } from "@peated/server/lib/strings";
import { type Bottle } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { IconButton, TextLink } from "../..";
import { useORPC } from "../../../lib/orpc/context";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

export default function ModerationBottlePicker({
  name,
  onClose,
  onSelect,
  open,
  returnTo,
  source,
}: {
  name?: string | null;
  onClose: () => void;
  onSelect?: (value: Bottle) => Promise<void>;
  open: boolean;
  returnTo?: string;
  source?: string;
}) {
  const [query, setQuery] = useState(name ?? "");
  const [results, setResults] = useState<Bottle[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successfulQuery, setSuccessfulQuery] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const orpc = useORPC();

  const search = useCallback(
    async (nextQuery = "") => {
      const version = ++requestVersion.current;
      setLoading(true);
      setError(null);
      setResults([]);
      setSuccessfulQuery(null);
      const { data, error: queryError } = await safe(
        orpc.bottles.list.call({ query: nextQuery }),
      );
      if (version !== requestVersion.current) return;
      if (queryError)
        setError("Unable to search the bottle catalog. Try again.");
      else {
        setResults(data.results);
        setSuccessfulQuery(nextQuery);
      }
      setLoading(false);
    },
    [orpc],
  );
  const onSearch = useDebounceCallback(search);

  useEffect(() => {
    onSearch.cancel();
    requestVersion.current += 1;
    setLoading(false);
    setResults([]);
    setError(null);
    setSuccessfulQuery(null);
    if (!open) return;
    setQuery(name ?? "");
    void onSearch(name ?? "");
  }, [name, onSearch, open]);

  function close() {
    onSearch.cancel();
    requestVersion.current += 1;
    setLoading(false);
    setError(null);
    onClose();
  }

  async function selectBottle(bottle: Bottle) {
    if (!onSelect) return;
    requestVersion.current += 1;
    setLoading(true);
    setError(null);
    try {
      await onSelect(bottle);
    } catch {
      setError(
        "Unable to assign this bottle. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!name) return null;
  const newBottleParams = new URLSearchParams({ name: toTitleCase(query) });
  if (returnTo) newBottleParams.set("returnTo", returnTo);
  const showAdd =
    !isLoading &&
    !error &&
    successfulQuery === query &&
    (results.length < 10 || query !== "");

  return (
    <Dialog onClose={close} open={open} {...stylex.props(styles.dialog)}>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <div {...stylex.props(styles.position)}>
        <DialogPanel {...stylex.props(styles.panel)}>
          <header {...stylex.props(styles.header)}>
            <DialogTitle {...stylex.props(styles.title)}>
              Choose bottle
            </DialogTitle>
            <IconButton
              icon={<X aria-hidden="true" size={18} />}
              label="Close"
              onClick={close}
              size="sm"
              variant="tonal"
            />
          </header>
          <div {...stylex.props(styles.searchRow)}>
            <input
              aria-label="Search bottles"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setQuery(value);
                requestVersion.current += 1;
                setLoading(false);
                setResults([]);
                setError(null);
                setSuccessfulQuery(null);
                void onSearch(value);
              }}
              placeholder="Search for a bottle"
              type="search"
              value={query}
              {...stylex.props(styles.search)}
            />
          </div>
          <div {...stylex.props(styles.context)}>
            Select the bottle identified as <strong>{name}</strong>.
            {source ? (
              <>
                {" "}
                Source:{" "}
                <TextLink
                  href={source}
                  rel="noreferrer"
                  size="inherit"
                  target="_blank"
                >
                  {source}
                </TextLink>
                .
              </>
            ) : null}
          </div>
          {error ? (
            <p role="alert" {...stylex.props(styles.error)}>
              {error}
            </p>
          ) : null}
          {isLoading ? (
            <p role="status" {...stylex.props(styles.status)}>
              Searching…
            </p>
          ) : null}
          <ul {...stylex.props(styles.results)}>
            {results.map((bottle) => (
              <li key={bottle.id} {...stylex.props(styles.resultItem)}>
                <button
                  disabled={isLoading}
                  onClick={() => void selectBottle(bottle)}
                  type="button"
                  {...stylex.props(styles.result)}
                >
                  <strong>{formatBottleDisplayName(bottle)}</strong>
                  <span {...stylex.props(styles.detail)}>
                    {bottle.distillers
                      .map((distiller) => distiller.name)
                      .join(", ")}
                  </span>
                </button>
              </li>
            ))}
            {showAdd ? (
              <li {...stylex.props(styles.resultItem)}>
                <Link
                  href={`/bottles/new?${newBottleParams.toString()}`}
                  {...stylex.props(styles.result, styles.add)}
                >
                  <Plus aria-hidden="true" size={18} />
                  <span>
                    <strong>Can’t find it?</strong>
                    <span {...stylex.props(styles.detail)}>
                      {query
                        ? `Add ${toTitleCase(query)} to the database.`
                        : "Add a new bottle to the database."}
                    </span>
                  </span>
                </Link>
              </li>
            ) : null}
          </ul>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

const styles = stylex.create({
  dialog: { position: "relative", zIndex: 60 },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgb(0 0 0 / 0.72)",
  },
  position: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: space.x4,
    overflowY: "auto",
  },
  panel: {
    width: "100%",
    maxWidth: "720px",
    maxHeight: "min(800px, calc(100dvh - 32px))",
    overflowY: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
  },
  header: {
    position: "sticky",
    zIndex: 2,
    top: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    padding: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: colors.ground,
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
  },
  searchRow: {
    padding: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  search: {
    boxSizing: "border-box",
    width: "100%",
    height: "42px",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
    "::-webkit-search-cancel-button": { appearance: "none" },
  },
  context: {
    padding: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  error: {
    margin: 0,
    padding: space.x4,
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
  status: {
    margin: 0,
    padding: space.x6,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    textAlign: "center",
  },
  results: { margin: 0, padding: 0, listStyle: "none" },
  resultItem: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  result: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minHeight: "60px",
    alignItems: "center",
    gap: space.x3,
    padding: space.x4,
    borderWidth: 0,
    outline: "none",
    backgroundColor: { default: "transparent", ":hover": colors.inset },
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  add: { color: colors.accentDeep },
  detail: {
    display: "block",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.4,
  },
});
