import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid";
import classNames from "../lib/classNames";

type RatingStats = {
  pass: number;
  sip: number;
  savor: number;
  total: number;
  avg: number | null;
  percentage: {
    pass: number;
    sip: number;
    savor: number;
  };
};

type Props = {
  stats: RatingStats;
  className?: string;
};

export default function SimpleRatingStats({ stats, className }: Props) {
  if (!stats || stats.total === 0) {
    return (
      <div className={classNames("text-muted text-sm", className)}>
        No ratings yet
      </div>
    );
  }

  const { percentage } = stats;

  return (
    <div className={className}>
      <div className="space-y-2">
        <RatingBar
          label="Savor"
          icon={HandThumbUpIcon}
          isDouble={true}
          count={stats.savor}
          percentage={percentage.savor}
        />
        <RatingBar
          label="Sip"
          icon={HandThumbUpIcon}
          count={stats.sip}
          percentage={percentage.sip}
        />
        <RatingBar
          label="Pass"
          icon={HandThumbDownIcon}
          count={stats.pass}
          percentage={percentage.pass}
        />
      </div>
    </div>
  );
}

function RatingBar({
  label,
  icon: Icon,
  isDouble = false,
  count,
  percentage,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isDouble?: boolean;
  count: number;
  percentage: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-20 items-center gap-2">
        <div className="flex items-center">
          <Icon className="h-4 w-4" />
          {isDouble && <Icon className="h-4 w-4" />}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>

      <div className="relative flex-1">
        <div className="h-6 overflow-hidden rounded border border-slate-700 bg-transparent">
          <div
            className="h-full bg-slate-700 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="text-muted w-16 text-right text-sm">
        {count} ({Math.round(percentage)}%)
      </div>
    </div>
  );
}
