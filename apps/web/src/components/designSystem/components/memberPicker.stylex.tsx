"use client";

import * as stylex from "@stylexjs/stylex";
import type { FocusEvent, KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { Chip } from "./chip.stylex";
import { OverlaySurface } from "./feedback.stylex";

export type MemberPickerOption = {
  detail?: string;
  id: number;
  username: string;
};

export type MemberPickerProps = {
  label?: string;
  onChange: (value: readonly MemberPickerOption[]) => void;
  options: readonly MemberPickerOption[];
  value: readonly MemberPickerOption[];
};

/** Selects existing friends for the tasting without creating new members. */
export function MemberPicker({
  label = "Friends",
  onChange,
  options,
  value,
}: MemberPickerProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const selectedIds = new Set(value.map((member) => member.id));
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return options.filter(
      (option) =>
        !selectedIds.has(option.id) &&
        (!normalizedQuery ||
          option.username.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [options, query, value]);
  const activeOption = filteredOptions[activeIndex];

  function selectMember(option: MemberPickerOption) {
    onChange([...value, option]);
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(false);
  }

  function removeMember(id: number) {
    onChange(value.filter((member) => member.id !== id));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredOptions.length) {
        setActiveIndex((current) =>
          current >= filteredOptions.length - 1 ? 0 : current + 1,
        );
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      if (filteredOptions.length) {
        setActiveIndex((current) =>
          current <= 0 ? filteredOptions.length - 1 : current - 1,
        );
      }
      return;
    }

    if (event.key === "Enter" && isOpen && activeOption) {
      event.preventDefault();
      selectMember(activeOption);
      return;
    }

    if (event.key === "Escape") {
      setActiveIndex(-1);
      setIsOpen(false);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveIndex(-1);
      setIsOpen(false);
    }
  }

  return (
    <div onBlur={handleBlur} {...stylex.props(styles.root)}>
      <label
        htmlFor={inputId}
        {...stylex.props(foundationStyles.fieldLabel, styles.label)}
      >
        {label}
      </label>
      {value.length ? (
        <div aria-label="Selected friends" {...stylex.props(styles.selected)}>
          {value.map((member) => (
            <Chip
              aria-label={`Remove ${member.username}`}
              key={member.id}
              onClick={() => removeMember(member.id)}
              variant="tinted"
            >
              {member.username} ×
            </Chip>
          ))}
        </div>
      ) : null}
      <div {...stylex.props(styles.position)}>
        <input
          aria-activedescendant={
            activeOption ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          id={inputId}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search friends"
          role="combobox"
          type="search"
          value={query}
          {...stylex.props(styles.input)}
        />
        {isOpen ? (
          <OverlaySurface {...stylex.props(styles.overlay)}>
            <div
              aria-label="Friend results"
              id={listboxId}
              role="listbox"
              {...stylex.props(styles.results)}
            >
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => (
                  <button
                    aria-selected={index === activeIndex}
                    id={`${listboxId}-option-${index}`}
                    key={option.id}
                    onClick={() => selectMember(option)}
                    onMouseMove={() => setActiveIndex(index)}
                    role="option"
                    type="button"
                    {...stylex.props(
                      styles.result,
                      index === activeIndex && styles.activeResult,
                    )}
                  >
                    <span {...stylex.props(styles.username)}>
                      {option.username}
                    </span>
                    {option.detail ? (
                      <span {...stylex.props(styles.detail)}>
                        {option.detail}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p role="status" {...stylex.props(styles.empty)}>
                  No matching friends.
                </p>
              )}
            </div>
          </OverlaySurface>
        ) : null}
      </div>
      <p {...stylex.props(foundationStyles.metadata, styles.help)}>
        The people enjoying this tasting with you.
      </p>
    </div>
  );
}

const styles = stylex.create({
  root: {
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  label: {
    color: colors.inkMuted,
  },
  selected: {
    display: "flex",
    gap: space.x2,
    flexWrap: "wrap",
  },
  position: {
    position: "relative",
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    height: controlMetrics.controlHeight,
    paddingRight: "14px",
    paddingLeft: "14px",
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.4,
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
    "::-webkit-search-cancel-button": {
      appearance: "none",
    },
  },
  overlay: {
    position: "absolute",
    zIndex: 10,
    top: "calc(100% + 4px)",
    right: 0,
    left: 0,
    overflow: "hidden",
  },
  results: {
    maxHeight: "240px",
    overflowY: "auto",
  },
  result: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-start",
    rowGap: space.x1,
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
    borderWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    outline: "none",
    backgroundColor: {
      default: colors.ground,
      ":hover": colors.surface,
    },
    color: colors.ink,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  activeResult: {
    backgroundColor: colors.surface,
  },
  username: {
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  detail: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
  },
  empty: {
    margin: 0,
    padding: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  help: {
    margin: 0,
    color: colors.inkMuted,
  },
});
