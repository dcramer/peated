export function absoluteUrl(url: string, baseUrl: string) {
  if (url.indexOf("/") !== 0) return url;
  const urlParts = new URL(baseUrl);
  return `${urlParts.origin}${url};`;
}

export function removeBottleSize(name: string) {
  return name.replace(/\([^)]+\)$/, "");
}

export function parsePrice(value: string) {
  // $XX.YY
  if (value.indexOf("$") !== 0) {
    return;
  }

  return parseInt(value.substring(1).replace(/[,.]/, ""), 10);
}
