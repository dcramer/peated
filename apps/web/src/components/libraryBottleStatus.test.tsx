import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  COLLECTION_BOTTLE_STATUS_VALUES,
  CollectionBottleStatusChips,
  CollectionBottleStatusLabel,
  getCollectionBottleStatusLabel,
} from "./libraryBottleStatus";

describe("library bottle status", () => {
  it("defines collector-facing labels for supported statuses", () => {
    expect(COLLECTION_BOTTLE_STATUS_VALUES).toEqual([
      "sealed",
      "open",
      "empty",
    ]);
    expect(getCollectionBottleStatusLabel("sealed")).toBe("Sealed");
    expect(getCollectionBottleStatusLabel("open")).toBe("Open");
    expect(getCollectionBottleStatusLabel("empty")).toBe("Empty");
    expect(getCollectionBottleStatusLabel(null)).toBe("Not set");
  });

  it("renders passive labels only when status is set", () => {
    expect(
      renderToStaticMarkup(<CollectionBottleStatusLabel status={null} />),
    ).toBe("");
    expect(
      renderToStaticMarkup(<CollectionBottleStatusLabel status="sealed" />),
    ).toContain("Sealed");
  });

  it("renders editable chips with the selected status pressed", () => {
    const html = renderToStaticMarkup(
      <CollectionBottleStatusChips value="open" onChange={() => {}} />,
    );

    expect(html).toContain("Sealed");
    expect(html).toContain("Open");
    expect(html).toContain("Empty");
    expect(html).toContain('aria-pressed="true"');
  });

  it("calls onChange when an unselected status chip is chosen", () => {
    const changes: string[] = [];
    const element = CollectionBottleStatusChips({
      value: "open",
      onChange: (status) => changes.push(status),
    });

    if (!isValidElement<{ children: ReactNode }>(element)) {
      throw new Error("Expected status chips to render an element.");
    }

    const buttons = Children.toArray(element.props.children).filter(
      (
        child,
      ): child is ReactElement<{
        children: string;
        onClick: () => void;
      }> => isValidElement(child),
    );
    const sealedButton = buttons.find(
      (button) => button.props.children === "Sealed",
    );

    expect(sealedButton).toBeDefined();
    sealedButton?.props.onClick();

    expect(changes).toEqual(["sealed"]);
  });
});
