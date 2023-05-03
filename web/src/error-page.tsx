import { useRouteError } from "react-router-dom";
import Layout from "./components/layout";
import { Link } from "react-router-dom";

export default function ErrorPage() {
  const error: any = useRouteError();
  console.error(error);

  return (
    <Layout>
      <main className="grid place-items-center bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="text-center">
          <p className="text-base font-semibold text-peated">Oops!</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Sorry, an unexpected error has occurred.
          </h1>
          <p className="mt-6 text-base leading-7 text-gray-600">
            The error we hit was "<i>{error.statusText || error.message}</i>".
          </p>
          {error.stack && (
            <div className="prose mx-auto mt-4">
              <pre className="text-left">{error.stack}</pre>
            </div>
          )}
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/"
              className="rounded bg-peated px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-peated-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated"
            >
              Go back home
            </Link>
            <a
              className="text-sm font-semibold text-gray-900"
              href="https://github.com/dcramer/cask"
            >
              Open a GitHub issue
            </a>
          </div>
        </div>
      </main>
    </Layout>
  );
}
