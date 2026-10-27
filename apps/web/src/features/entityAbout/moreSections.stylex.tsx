"use client";

import * as stylex from "@stylexjs/stylex";
import { useId, useState, type ReactNode } from "react";

import { Button } from "../../components/button.stylex";
import { space } from "../../styles/tokens.stylex";

/**
 * Holds the later history sections behind a button. They stay in the page's
 * HTML, so search engines and find-in-page still read them.
 */
export function MoreSections({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div hidden={!expanded} id={contentId}>
        {children}
      </div>
      {expanded ? null : (
        <div {...stylex.props(styles.action)}>
          <Button
            aria-controls={contentId}
            aria-expanded={false}
            onClick={() => setExpanded(true)}
            variant="tonal"
          >
            Show the full history ({count} more{" "}
            {count === 1 ? "section" : "sections"})
          </Button>
        </div>
      )}
    </>
  );
}

const styles = stylex.create({
  action: {
    paddingTop: space.x6,
  },
});
