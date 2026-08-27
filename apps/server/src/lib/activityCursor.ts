export type ActivityCursor = {
  page: number;
  snapshotAt: Date;
};

export function encodeActivityCursor({ page, snapshotAt }: ActivityCursor) {
  return `${page}:${snapshotAt.getTime()}`;
}

export function parseActivityCursor(value: string): ActivityCursor | null {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) return null;

  const page = Number(match[1]);
  const timestamp = Number(match[2]);
  const snapshotAt = new Date(timestamp);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(timestamp) ||
    Number.isNaN(snapshotAt.getTime())
  ) {
    return null;
  }

  return { page, snapshotAt };
}
