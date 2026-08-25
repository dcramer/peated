import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";

export default function CarouselControls({
  currentIndex,
  total,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  label = "Carousel controls",
  counterLabel,
}: {
  currentIndex: number;
  total: number;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  label?: string;
  counterLabel?: string;
}) {
  if (total < 2) return null;

  const buttonClassName =
    "text-muted focus-visible:outline-peated flex h-8 w-8 items-center justify-center transition-colors hover:bg-slate-800 hover:text-white focus-visible:z-10 focus-visible:outline focus-visible:outline-2 disabled:cursor-default disabled:text-slate-600 disabled:hover:bg-transparent sm:h-9 sm:w-9";

  return (
    <div
      className="flex shrink-0 items-center sm:border sm:border-slate-700/70"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={previousDisabled}
        className={buttonClassName}
        aria-label={previousLabel}
      >
        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <span
        className="text-muted flex h-8 w-12 items-center justify-center px-1 text-xs font-semibold tabular-nums sm:h-9 sm:border-x sm:border-slate-700/70"
        aria-live="polite"
        aria-atomic="true"
      >
        {counterLabel ? (
          <span className="sr-only">{counterLabel}. </span>
        ) : null}
        {currentIndex + 1} / {total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={buttonClassName}
        aria-label={nextLabel}
      >
        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
