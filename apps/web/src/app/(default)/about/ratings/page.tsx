import { TASTING_BANDS } from "@peated/server/constants";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Whisky Rating Guide",
  description:
    "A simple guide to Peated tasting bands and 100-point external reviews.",
};

const BAND_STYLES = {
  95: "border-amber-300/60 bg-amber-300/15",
  90: "border-yellow-300/50 bg-yellow-300/10",
  85: "border-lime-300/40 bg-lime-300/10",
  80: "border-emerald-300/40 bg-emerald-300/10",
  0: "border-slate-600 bg-slate-900",
} satisfies Record<number, string>;

export default function RatingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <div className="text-highlight mb-3 text-sm font-semibold uppercase tracking-wide">
          Peated ratings
        </div>
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">
          Tastings and reviews
        </h1>
        <p className="text-muted mt-5 text-lg leading-8">
          Use a broad band for a tasting. Use a 100-point score when you write a
          review. Each keeps a clear purpose.
        </p>
      </header>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <div className="text-muted text-sm font-medium">For a tasting</div>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Choose a broad band
          </h2>
          <div className="mt-6 space-y-3">
            {TASTING_BANDS.map((band) => (
              <RatingChoice
                key={band.id}
                label={band.label}
                description={`${band.min}–${band.max}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <div className="text-muted text-sm font-medium">For a review</div>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            The 100-point scale
          </h2>
          <div className="mt-6 flex items-end gap-4">
            <div className="text-highlight text-6xl font-semibold leading-none">
              92
            </div>
            <div className="pb-1">
              <div className="font-semibold text-white">Outstanding</div>
              <div className="text-muted text-sm">out of 100</div>
            </div>
          </div>
          <p className="text-muted mt-5 leading-7">
            Pick a whole number from 0 to 100 and add notes when useful. A
            review is one considered opinion about the Bottle.
          </p>
        </div>
      </section>

      <section className="mt-14 rounded-xl border border-slate-700 bg-slate-900/50 p-6 sm:p-8">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-white">
            How to write a review
          </h2>
          <p className="text-muted mt-2 leading-7">
            Taste first. Then choose the whole number that best states your
            view.
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <ScoreStep number="1" title="Taste first">
            Take a sip and notice what stands out before thinking about a
            number.
          </ScoreStep>
          <ScoreStep number="2" title="Start at 80">
            An 80 is good: enjoyable, well made, and without a major problem.
          </ScoreStep>
          <ScoreStep number="3" title="Move the score">
            Judge the whisky as a whole. There are no points to add up.
          </ScoreStep>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-5">
            <h3 className="font-semibold text-emerald-200">Move up when</h3>
            <p className="text-muted mt-2 leading-7">
              Flavors are clear, the parts work well together, the texture has
              depth, and the finish lasts.
            </p>
          </div>
          <div className="rounded-lg border border-orange-300/30 bg-orange-300/10 p-5">
            <h3 className="font-semibold text-orange-200">Move down when</h3>
            <p className="text-muted mt-2 leading-7">
              There are off flavors, rough alcohol, a thin texture, poor
              balance, or a finish that fades quickly.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-950/70 p-5 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h3 className="font-semibold text-white">Pick the exact point</h3>
            <p className="text-muted mt-2 leading-7">
              Use the bottom of a band when it just fits, the middle when it
              clearly fits, and the top when it nearly reaches the next band.
            </p>
          </div>
          <div className="mt-5 flex shrink-0 items-center justify-center gap-4 sm:mt-0">
            <ScoreExample score="85" label="just" />
            <ScoreExample score="87" label="clearly" />
            <ScoreExample score="89" label="nearly" />
          </div>
        </div>

        <p className="text-muted mt-5 text-sm leading-6">
          Keep price, rarity, packaging, and reputation out of the score. Add
          tasting notes when the number needs more context.
        </p>
      </section>

      <section className="mt-14">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-white">
            The score at a glance
          </h2>
          <p className="text-muted mt-2">
            The same labels appear anywhere Peated shows a 100-point score.
          </p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {TASTING_BANDS.map((band) => (
            <div
              className={`flex items-center justify-between rounded-lg border px-5 py-4 ${BAND_STYLES[band.min]}`}
              key={band.min}
            >
              <span className="font-semibold text-white">{band.label}</span>
              <span className="text-muted font-mono text-sm">
                {band.min}–{band.max}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 border-t border-slate-800 pt-10 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-white">Community scores</h2>
          <p className="text-muted mt-3 leading-7">
            Peated shows the median after at least 20 member and permitted
            external review scores exist.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Critic scores</h2>
          <p className="text-muted mt-3 leading-7">
            Peated includes a critic score only when the publication allows it
            and the source gives a whole-number score on a 100-point scale.
          </p>
        </div>
      </section>
    </main>
  );
}

function ScoreStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-950/70 p-5">
      <div className="text-highlight flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold">
        {number}
      </div>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="text-muted mt-2 leading-7">{children}</p>
    </div>
  );
}

function ScoreExample({ score, label }: { score: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-highlight text-2xl font-semibold">{score}</div>
      <div className="text-muted mt-1 text-xs">{label}</div>
    </div>
  );
}

function RatingChoice({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-slate-950/70 px-4 py-3">
      <span className="text-highlight w-14 font-semibold">{label}</span>
      <span className="text-muted text-sm">{description}</span>
    </div>
  );
}
