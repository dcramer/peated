export default ({ ...props }: React.ComponentPropsWithoutRef<"textarea">) => {
  const baseStyles = "bg-inherit rounded border-0 focus:ring-0";
  const inputStyles = "placeholder:text-slate-700 sm:leading-6";
  return (
    <textarea
      className={`block min-w-full p-0 ${baseStyles} ${inputStyles}`}
      {...props}
    />
  );
};
