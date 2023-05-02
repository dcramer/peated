export default ({ ...props }: React.ComponentPropsWithoutRef<"select">) => {
  const baseStyles =
    "bg-white rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-peated sm:text-sm sm:leading-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-peated";
  const inputStyles =
    "text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6";
  return (
    <div className="mt-2">
      <select
        className={`block min-w-full py-1.5 px-3 ${baseStyles} ${inputStyles}`}
        {...props}
      />
    </div>
  );
};
