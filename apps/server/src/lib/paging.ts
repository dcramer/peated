import config from "../config";

export const buildPageLink = (path: string, query: any, newPage: number) => {
  const parts: string[] = [];
  for (const param in query) {
    if (param !== "page") {
      parts.push(`${param}=${encodeURIComponent(query[param])}`);
    }
  }
  parts.push(`page=${newPage}`);
  return `${config.API_SERVER}${path}?${parts.join("&")}`;
};
