export default ({
  suffixLabel,
  noGutter,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & {
  suffixLabel?: string;
  noGutter?: boolean;
}) => {
  const baseStyles =
    "bg-white rounded p-0 border-0 text-gray-900 text-sm sm:leading-6";
  const inputStyles =
    "text-gray-900 placeholder:text-gray-400 focus:ring-0 text-sm sm:leading-6";
  if (suffixLabel) {
    return (
      <div className={`flex ${baseStyles}`}>
        <input
          className={`block p-0 flex-1 border-0 bg-transparent ${inputStyles} ${className}`}
          {...props}
        />
        <span className="flex select-none items-center text-gray-500 sm:text-sm">
          {suffixLabel}
        </span>
      </div>
    );
  }

  return (
    <input
      className={`block min-w-full ${baseStyles} ${inputStyles} ${className}`}
      {...props}
    />
  );
};
