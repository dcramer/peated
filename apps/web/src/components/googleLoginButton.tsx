"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Button from "./button";
import Link from "./link";

export default function GoogleLoginButton({
  action,
  title = "Sign in with Google",
  requireTos = true,
}: {
  action: (formData: FormData) => Promise<any>;
  title?: string;
  requireTos?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const searchParams = useSearchParams();

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      const data = new FormData();
      data.append("code", codeResponse.code);
      if (searchParams.get("redirectTo"))
        data.append("redirectTo", searchParams.get("redirectTo") as string);
      if (tosAccepted) data.append("tosAccepted", "true");
      // TODO:
      await action(data);

      setLoading(false);
    },
    onError: () => {
      console.log("Login Failed");
      setLoading(false);
    },
  });

  return (
    <>
      <Button
        fullWidth
        color="highlight"
        onClick={() => {
          if (requireTos) {
            setShowTos(true);
          } else {
            setLoading(true);
            googleLogin();
          }
        }}
        disabled={loading}
      >
        <svg
          className="-ml-1 mr-2 h-4 w-4"
          aria-hidden="true"
          focusable="false"
          data-prefix="fab"
          data-icon="google"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 488 512"
        >
          <path
            fill="currentColor"
            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
          ></path>
        </svg>
        {title}
      </Button>

      {showTos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-md bg-slate-800 p-4 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">Terms of Service</h2>
            <p className="mb-3 text-sm text-slate-300">
              You must agree to our{" "}
              <Link
                href="https://peated.com/terms"
                className="text-highlight underline"
              >
                Terms of Service
              </Link>{" "}
              to continue with Google.
            </p>
            <label className="mb-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
              />
              <span>I agree to the Terms of Service.</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowTos(false)} color="default">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!tosAccepted) return;
                  setShowTos(false);
                  setLoading(true);
                  googleLogin();
                }}
                color="highlight"
                disabled={!tosAccepted}
              >
                Continue with Google
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
