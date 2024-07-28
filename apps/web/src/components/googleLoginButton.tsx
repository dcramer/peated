"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import Button from "./button";

export default function GoogleLoginButton({
  action,
  title = "Sign in with Google",
}: {
  action: (formData: FormData) => Promise<any>;
  title?: string;
}) {
  const [loading, setLoading] = useState(false);
  const { pending } = useFormStatus();
  const searchParams = useSearchParams();

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      const data = new FormData();
      data.append("code", codeResponse.code);
      if (searchParams.get("redirectTo"))
        data.append("redirectTo", searchParams.get("redirectTo") as string);
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
    <Button
      fullWidth
      color="highlight"
      onClick={() => {
        setLoading(true);
        googleLogin();
      }}
      disabled={loading || pending}
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
  );
}
