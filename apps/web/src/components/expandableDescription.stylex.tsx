"use client";

import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";

import { summarize } from "../lib/markdown";
import { space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";
import Markdown from "./markdown";

const PREVIEW_SENTENCES = 2;

export function getDescriptionPreview(content: string) {
  const text = summarize(content, Number.MAX_SAFE_INTEGER)
    .replace(/\s+/g, " ")
    .trim();
  const sentences = [
    ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text),
  ];
  const preview = sentences
    .slice(0, PREVIEW_SENTENCES)
    .map(({ segment }) => segment.trim())
    .join(" ");

  return {
    text: preview,
    truncated: sentences.length > PREVIEW_SENTENCES,
  };
}

export function ExpandableDescription({
  content,
  noLinks = false,
}: {
  content: string;
  noLinks?: boolean;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const preview = getDescriptionPreview(content);

  if (!preview.truncated) {
    return <Markdown content={content} noLinks={noLinks} />;
  }

  return (
    <div>
      <div id={contentId}>
        <Markdown
          content={expanded ? content : preview.text}
          noLinks={noLinks}
        />
      </div>
      <div {...stylex.props(styles.action)}>
        <Button
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          variant="text"
        >
          {expanded ? "Show less" : "Read more"}
        </Button>
      </div>
    </div>
  );
}

const styles = stylex.create({
  action: {
    marginTop: space.x1,
    marginLeft: "-12px",
  },
});
