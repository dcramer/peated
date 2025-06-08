import DOMPurify from "isomorphic-dompurify";
const { sanitize } = DOMPurify;
import { marked } from "marked";

export const summarize = (content: string, maxLength = 256): string => {
  // first remove elements we wouldn't want as a summary
  const contentBlocks = sanitize(marked.parse(content, { breaks: true }), {
    ALLOWED_TAGS: ["p", "blockquote", "#text", "strong", "b", "em", "i", "a"],
    KEEP_CONTENT: false,
  });
  const sum = sanitize(contentBlocks, {
    ALLOWED_TAGS: [],
  }).replace(/^[\s\n]+|[\s\n]+$/g, "");
  if (sum.length > maxLength)
    return `${sum.substring(0, maxLength - 3).split("\n")[0]}...`;
  return sum;
};
