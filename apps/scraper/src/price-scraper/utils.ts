export function absoluteUrl(url: string, baseUrl: string) {
  if (url.indexOf("https://") === 0) return url;
  const urlParts = new URL(baseUrl);
  return `${urlParts.origin}${url.indexOf("/") !== 0 ? "/" : ""}${url}`;
}

export function removeBottleSize(name: string) {
  return name.replace(/\([^)]+\)$/, "");
}

export function parsePrice(value: string) {
  // $XX.YY
  if (value.indexOf("$") !== 0) {
    return;
  }

  const unit = value.substring(0, 1);
  const price = parseInt(value.substring(1).replaceAll(/[,.]/gi, ""), 10);

  // only working for USD atm
  if (unit === "$" && value.indexOf(".") !== -1) {
    return price;
  }

  return price * 100;
}
