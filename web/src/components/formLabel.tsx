export default ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) => {
  return (
    <label
      {...props}
      className={`block text-sm font-medium leading-6 text-gray-900 ${
        className || ""
      }`}
    />
  );
};
