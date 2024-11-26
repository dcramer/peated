export function Auth({
  actionText,
  onSubmit,
  status,
  afterSubmit,
}: {
  actionText: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: "pending" | "idle" | "success" | "error";
  afterSubmit?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex items-start justify-center bg-white p-8 dark:bg-black">
      <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-900">
        <h1 className="mb-4 text-2xl font-bold">{actionText}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-xs">
              Username
            </label>
            <input
              type="email"
              name="email"
              id="email"
              className="w-full rounded border border-gray-500/20 bg-white px-2 py-1 dark:bg-gray-800"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              className="w-full rounded border border-gray-500/20 bg-white px-2 py-1 dark:bg-gray-800"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-cyan-600 py-2 font-black uppercase text-white"
            disabled={status === "pending"}
          >
            {status === "pending" ? "..." : actionText}
          </button>
          {afterSubmit ? afterSubmit : null}
        </form>
      </div>
    </div>
  );
}
