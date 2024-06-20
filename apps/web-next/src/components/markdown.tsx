import { sanitize } from "isomorphic-dompurify";
import { marked } from "marked";

const renderer = new marked.Renderer();

// add captions to images
renderer.image = function (href, title, text) {
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

export default function Markdown({ content, ...props }: { content: string }) {
  const html = sanitize(parseMarkdown(content));
  return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}
