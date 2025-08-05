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

  const { percentage, total } = stats;

  // Find the dominant rating
  const dominant = Object.entries(percentage).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  )[0] as keyof typeof percentage;

  const dominantConfig = {
    pass: {
      label: "would pass",
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    sip: {
      label: "would sip",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    savor: {
      label: "would savor",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  };

  const config = dominantConfig[dominant];

  return (
    <div className={className}>
      {/* Summary */}
      <div className="mb-3">
        <span className={classNames("text-lg font-semibold", config.color)}>
          {Math.round(percentage[dominant])}%
        </span>
        <span className="text-muted ml-1">{config.label}</span>
        <span className="text-muted ml-2 text-sm">
          ({total} {total === 1 ? "rating" : "ratings"})
        </span>
      </div>

      {/* Distribution bars */}
      <div className="space-y-2">
        <RatingBar
          label="Pass"
          icon="🚫"
          count={stats.pass}
          percentage={percentage.pass}
          color="bg-red-500"
          bgColor="bg-red-100"
        />
        <RatingBar
          label="Sip"
          icon="🥃"
          count={stats.sip}
          percentage={percentage.sip}
          color="bg-yellow-500"
          bgColor="bg-yellow-100"
        />
        <RatingBar
          label="Savor"
          icon="🥃🥃"
          count={stats.savor}
          percentage={percentage.savor}
          color="bg-green-500"
          bgColor="bg-green-100"
        />
      </div>
    </div>
  );
}

function RatingBar({
  label,
  icon,
  count,
  percentage,
  color,
  bgColor,
}: {
  label: string;
  icon: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-20 items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>

      <div className="flex-1">
        <div
          className={classNames("h-6 overflow-hidden rounded-full", bgColor)}
        >
          <div
            className={classNames("h-full transition-all", color)}
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
