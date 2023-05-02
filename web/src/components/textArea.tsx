export default ({
  suffixLabel,
  ...props
}: { suffixLabel?: string } & React.ComponentPropsWithoutRef<"select">) => {
  const baseStyles =
    "bg-white rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-peated sm:text-sm sm:leading-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-peated";
  const inputStyles =
    "text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6";
  if (suffixLabel) {
    return (
      <div className="mt-2">
        <div className={`flex ${baseStyles}`}>
          <input
            className={`block flex-1 border-0 bg-transparent pl-3 ${inputStyles}`}
            {...props}
          />
          <span className="flex select-none items-center pr-3 text-gray-500 sm:text-sm">
            {suffixLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <input
        className={`block w-full py-1.5 ${baseStyles} ${inputStyles}`}
        {...props}
      />
    </div>
  );
};
