import Button from "@peated/web/components/button";
import classNames from "@peated/web/lib/classNames";

type BadgeTone = "amber" | "emerald" | "sky" | "slate";

type WorkbenchCardBadge = {
  label: string;
  tone?: BadgeTone;
};

type Props = {
  badges?: WorkbenchCardBadge[];
  detail: string;
  href: string;
  hrefLabel: string;
  summary: string;
  title: string;
  whenToUse: string;
};

function getBadgeClassName(tone: BadgeTone) {
  switch (tone) {
    case "amber":
      return "border-amber-800 bg-amber-950/60 text-amber-200";
    case "emerald":
      return "border-emerald-800 bg-emerald-950/60 text-emerald-200";
    case "sky":
      return "border-sky-800 bg-sky-950/60 text-sky-200";
    case "slate":
      return "border-slate-700 bg-slate-900 text-slate-200";
  }
}

export default function WorkbenchCard({
  badges = [],
  detail,
  href,
  hrefLabel,
  summary,
  title,
  whenToUse,
}: Props) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
      <div className="flex h-full flex-col gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={classNames(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                  getBadgeClassName(badge.tone ?? "slate"),
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-300">{summary}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Best for
          </div>
          <div className="mt-1">{whenToUse}</div>
        </div>

        <div className="min-h-11 text-sm text-slate-400">{detail}</div>

        <div className="mt-auto">
          <Button href={href} color="primary">
            {hrefLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}
