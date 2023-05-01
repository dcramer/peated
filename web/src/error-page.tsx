import { useRouteError } from "react-router-dom";
import Layout from "./components/layout";

export default function ErrorPage() {
  const error: any = useRouteError();
  console.error(error);

  return (
    <Layout>
      <div className="bg-gray-50 sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6 prose">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Oops!
          </h3>
          <div>
            <p className="text-gray-500">
              Sorry, an unexpected error has occurred.
            </p>
            <p className="text-gray-500">
              The error we hit was "<i>{error.statusText || error.message}</i>".
            </p>
            {error.prepareStackTrace && <pre>{error.prepareStackTrace()}</pre>}
          </div>
          <div className="mt-5">
            <a
              type="button"
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              href="https://github.com/dcramer/cask"
            >
              Open a GitHub issue
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
