import { type RouterOutputs } from "../lib/trpc/client";
import Price from "./price";

export default function BottleStats({
  bottle,
}: {
  bottle: RouterOutputs["bottleById"];
}) {
  const stats = [
    {
      name: "Avg Rating",
      value:
        bottle.avgRating !== null
          ? (Math.round(bottle.avgRating * 100) / 100).toFixed(2)
          : "",
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
    { name: "People", value: bottle.people.toLocaleString() },
    {
      name: "Price",
      value: bottle.lastPrice ? (
        <a
          href={bottle.lastPrice.url}
          className="hover:underline"
          target="_blank"
        >
          <Price
            value={bottle.lastPrice.price}
            currency={bottle.lastPrice.currency}
            noCents
          />
        </a>
      ) : null,
    },
  ];

  return (
    <div className="my-6 grid grid-cols-2 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
      {stats.map((stat) => (
        <div key={stat.name}>
          <div className="text-muted leading-7">{stat.name}</div>
          <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
            {stat.value || "-"}
          </div>
        </div>
      ))}
    </div>
  );
}
