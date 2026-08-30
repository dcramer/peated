"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";

type ListboxNavigationOptions<Item> = {
  items: readonly Item[];
  onClose: () => void;
  onOpen: () => void;
  onSelect: (item: Item) => void;
  open: boolean;
};

/** Keeps keyboard movement consistent across the pickers without merging their UI. */
export function useListboxNavigation<Item>({
  items,
  onClose,
  onOpen,
  onSelect,
  open,
}: ListboxNavigationOptions<Item>) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeItem = items[activeIndex];

  function resetNavigation() {
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onOpen();
      if (items.length > 0) {
        setActiveIndex((current) => {
          if (event.key === "ArrowDown") {
            return current >= items.length - 1 ? 0 : current + 1;
          }
          return current <= 0 ? items.length - 1 : current - 1;
        });
      }
      return;
    }

    if (event.key === "Enter" && open && activeItem) {
      event.preventDefault();
      resetNavigation();
      onSelect(activeItem);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetNavigation();
      onClose();
    }
  }

  return {
    activeIndex,
    activeItem,
    handleKeyDown,
    resetNavigation,
    setActiveIndex,
  };
}
