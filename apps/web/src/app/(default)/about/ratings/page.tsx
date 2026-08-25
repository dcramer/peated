import { ADVANCED_RATING_BANDS } from "@peated/server/constants";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Whisky Rating Guide",
  description:
    "A simple guide to Pass, Sip, Savor and Peated's 100-point whisky scores.",
};

const BAND_STYLES: Record<number, string> = {
  95: "border-amber-300/60 bg-amber-300/15",
  90: "border-yellow-300/50 bg-yellow-300/10",
  85: "border-lime-300/40 bg-lime-300/10",
  80: "border-emerald-300/40 bg-emerald-300/10",
  75: "border-sky-300/40 bg-sky-300/10",
  0: "border-slate-600 bg-slate-900",
};

export default function RatingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <div className="text-highlight mb-3 text-sm font-semibold uppercase tracking-wide">
          Peated ratings
        </div>
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">
          Rate it your way
        </h1>
        <p className="text-muted mt-5 text-lg leading-8">
          Choose a quick rating or a 100-point score. They stay separate, so
          every rating keeps its meaning.
        </p>
      </header>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <div className="text-muted text-sm font-medium">For a quick take</div>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Pass, Sip, or Savor
          </h2>
          <div className="mt-6 space-y-3">
            <RatingChoice label="Pass" description="Not my thing." />
            <RatingChoice
              label="Sip"
              description="Enjoyable. I would drink it again."
            />
            <RatingChoice
              label="Savor"
              description="Amazing. I would seek it out."
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <div className="text-muted text-sm font-medium">
            For closer comparison
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            The 100-point scale
          </h2>
          <div className="mt-6 flex items-end gap-4">
            <div className="text-highlight text-6xl font-semibold leading-none">
              92
            </div>
            <div className="pb-1">
              <div className="font-semibold text-white">Exceptional</div>
              <div className="text-muted text-sm">out of 100</div>
            </div>
          </div>
          <p className="text-muted mt-5 leading-7">
            Pick a whole number from 0 to 100. An 80 means good—not 80% or a
            school grade. Scores above 90 should be rare.
          </p>
        </div>
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
          {ADVANCED_RATING_BANDS.map((band) => (
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

      <section className="mt-14 rounded-xl border border-slate-700 bg-slate-900/50 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-white">
          Score what is in the glass
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold text-white">Think about</h3>
            <p className="text-muted mt-2 leading-7">
              Smell, flavor, feel, balance, and finish.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Leave out</h3>
            <p className="text-muted mt-2 leading-7">
              Price, rarity, packaging, and reputation.
            </p>
          </div>
        </div>
        <p className="text-muted mt-6 border-t border-slate-700 pt-6 leading-7">
          One point can show a small personal preference. It is not an exact
          measurement, so add tasting notes when the number needs context.
        </p>
      </section>

      <section className="mt-14 grid gap-8 border-t border-slate-800 pt-10 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-white">Community scores</h2>
          <p className="text-muted mt-3 leading-7">
            Peated shows the average score from its users and how many people
            scored the whisky.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Critic scores</h2>
          <p className="text-muted mt-3 leading-7">
            Critic scores stay with the publication that gave them. They use the
            same labels, but never change the Peated community score.
          </p>
        </div>
      </section>
    </main>
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
