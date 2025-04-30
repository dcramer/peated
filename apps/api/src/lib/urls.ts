export function absoluteUrl(baseUrl: string, urlOrPath: string) {
  if (urlOrPath.indexOf("https://") === 0 || urlOrPath.indexOf("http://") === 0)
    return urlOrPath;
  const urlParts = new URL(baseUrl);
  return `${urlParts.origin}${urlOrPath.indexOf("/") !== 0 ? "/" : ""}${urlOrPath}`;
}
