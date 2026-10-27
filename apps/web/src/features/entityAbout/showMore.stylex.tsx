"use client";

import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "../../components/button.stylex";
import { space } from "../../styles/tokens.stylex";

/**
 * Holds part of the About content behind a button. It stays in the page's
 * HTML, so search engines and find-in-page still read it. A link to an
 * anchor inside, such as a citation number, opens it and scrolls there.
 */
export function ShowMore({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    function revealTarget() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target || !document.getElementById(contentId)?.contains(target)) {
        return;
      }
      setExpanded(true);
      // Wait for the content to show before scrolling to it.
      requestAnimationFrame(() => target.scrollIntoView());
    }
    revealTarget();
    window.addEventListener("hashchange", revealTarget);
    return () => window.removeEventListener("hashchange", revealTarget);
  }, [contentId]);

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
            {label}
          </Button>
        </div>
      )}
    </>
  );
}

const styles = stylex.create({
  action: {
    paddingTop: space.x3,
  },
});
