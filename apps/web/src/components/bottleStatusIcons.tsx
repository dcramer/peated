import {
  BookOpenIcon,
  CheckBadgeIcon,
  StarIcon,
} from "@heroicons/react/20/solid";
import type { Bottle } from "@peated/server/types";

type BottleStatusIconsProps = {
  bottle: Pick<Bottle, "isFavorite" | "isLibrary" | "hasTasted">;
  className?: string;
};

export default function BottleStatusIcons({
  bottle,
  className = "h-4 w-4",
}: BottleStatusIconsProps) {
  return (
    <>
      {bottle.isFavorite && (
        <span
          role="img"
          aria-label="Favorite"
          title="Favorite"
          className="inline-flex align-text-bottom"
          data-bottle-status="favorite"
        >
          <StarIcon className={className} aria-hidden="true" />
        </span>
      )}
      {bottle.isLibrary && (
        <span
          role="img"
          aria-label="In Library"
          title="In Library"
          className="inline-flex align-text-bottom"
          data-bottle-status="library"
        >
          <BookOpenIcon className={className} aria-hidden="true" />
        </span>
      )}
      {bottle.hasTasted && (
        <span
          role="img"
          aria-label="Tasted"
          title="Tasted"
          className="inline-flex align-text-bottom"
          data-bottle-status="tasted"
        >
          <CheckBadgeIcon className={className} aria-hidden="true" />
        </span>
      )}
    </>
  );
}
