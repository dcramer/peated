import config from "../config";

export const buildPageLink = (path: string, query: any, newPage: number) => {
  const parts: string[] = [];
  for (let param in query) {
    if (param !== "page") {
      parts.push(`${param}=${encodeURIComponent(query[param])}`);
    }
  }
  parts.push(`page=${newPage}`);
  return `${config.URL_PREFIX}${path}?${parts.join("&")}`;
};
