import { Children, isValidElement, type ReactNode } from "react";

/** Returns the visible text from simple React content for a native title. */
export function getTextTitle(content: ReactNode): string | undefined {
  const parts: string[] = [];

  function collect(value: ReactNode) {
    Children.forEach(value, (child) => {
      if (isValidElement<{ children?: ReactNode }>(child)) {
        collect(child.props.children);
      } else if (child !== null && child !== undefined) {
        // SAFETY: React.Children normalizes empty nodes and rejects object children before this callback.
        parts.push(String(child as string | number | bigint));
      }
    });
  }

  collect(content);
  const title = parts.join("").trim();
  return title || undefined;
}
