export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const escapeCdata = (value: string): string => {
  return value.replace(/\]\]>/g, "]]]]><![CDATA[>");
};
