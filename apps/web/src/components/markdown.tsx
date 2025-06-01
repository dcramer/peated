import { sanitize } from "isomorphic-dompurify";
import { marked } from "marked";

const renderer = new marked.Renderer();

// add captions to images
renderer.image = (href, title, text) => {
  const html = `<figure><img src="${href}" title="${title}" alt="${text}" /></figure>`;
  if (title) {
    return `<figure>
      ${html}
      <figcaption>${title}</figcaption>
      </figure>`;
  }
  return html;
};

const parseMarkdown = (content: string, options = {}): string => {
  return marked.parse(content, {
    renderer,
    breaks: true,
    ...options,
  });
};

const ALLOWED_TAGS = [
  "#text",
  "strong",
  "b",
  "em",
  "i",
  "blockquote",
  "q",
  "p",
];

export default function Markdown({
  content,
  noLinks = false,
  ...props
}: {
  content: string;
  noLinks?: boolean;
}) {
  const html = sanitize(parseMarkdown(content), {
    ALLOWED_TAGS: noLinks ? ALLOWED_TAGS : ["a", ...ALLOWED_TAGS],
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}
