export default ({
  className,
  required,
  ...props
}: { required?: boolean } & React.ComponentPropsWithoutRef<"label">) => {
  return (
    <div className="mb-2 flex justify-between">
      <label
        {...props}
        className={`block font-semibold leading-6 ${className || ""}`}
      />
      {!required && (
        <span className="text-xs leading-6 text-slate-500">Optional</span>
      )}
    </div>
  );
};
