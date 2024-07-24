export function absoluteUri(url: string, host: string) {
  if (url.indexOf("https://") === 0 || url.indexOf("http://") === 0) return url;
  return `${host}${url}`;
}
