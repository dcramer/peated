type ButtonColor = "primary" | "default" | undefined;

type Props = React.ComponentPropsWithoutRef<"button"> & {
  color?: ButtonColor;
};

export default ({ color, ...props }: Props) => {
  const defaultClassName =
    "inline-flex justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated";

  let colorClassName;
  switch (color) {
    case "primary":
      colorClassName =
        "bg-peated border-peated text-white hover:bg-peated-dark";
      break;
    default:
      colorClassName =
        "bg-white border-peated text-peated hover:bg-peated-light";
  }

  return (
    <button className={`${defaultClassName} ${colorClassName}`} {...props} />
  );
};
