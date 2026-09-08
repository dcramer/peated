/** JSON-LD rule: escape HTML delimiters before embedding stored data in a script. */
export function serializeJsonLd(document: {
  "@context": string;
  "@type": unknown;
}): string {
  return JSON.stringify(document).replace(/</g, "\\u003c");
}
