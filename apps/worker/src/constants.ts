export const defaultHeaders = (url: string) => {
  const urlParts = new URL(url);
  return {
    Authority: urlParts.hostname,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7,",
    "Accept-Language": "en-US,en:q=0.9",
    Referer: urlParts.origin,
  };
};
