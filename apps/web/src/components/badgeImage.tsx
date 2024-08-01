import { type Badge } from "@peated/server/types";

export function PlaceholderBadgeImage({ size = 64 }: { size?: number }) {
  return (
    <div
      className="rounded border-4 border-slate-800"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

export default function BadgeImage({
  badge,
  size = 64,
}: {
  badge: Badge;
  size?: number;
}) {
  if (!badge.imageUrl) return <PlaceholderBadgeImage size={size} />;
  return (
    <img
      src={badge.imageUrl}
      alt={badge.name}
      className="rounded"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
