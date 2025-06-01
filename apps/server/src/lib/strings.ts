export function toTitleCase(value: string) {
  const words = value.toLowerCase().replaceAll("_", " ").split(" ");
  for (let i = 0; i < words.length; i++) {
    words[i] = (words[i][0] || "").toUpperCase() + words[i].slice(1);
  }
  return words.join(" ");
}

// https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
export function humanizeBytes(bytes: number, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return `${bytes} B`;
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** dp;
  let currentBytes = bytes;

  do {
    currentBytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(currentBytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return `${currentBytes.toFixed(dp)} ${units[u]}`;
}

export function stripSuffix(value: string, suffix: string) {
  if (value.endsWith(suffix)) {
    return value.substring(0, value.length - suffix.length);
  }
  return value;
}

export function stripPrefix(value: string, prefix: string) {
  if (value.startsWith(prefix)) {
    return value.substring(prefix.length);
  }
  return value;
}
