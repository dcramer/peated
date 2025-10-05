"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import Collapsable from "@peated/web/components/collapsable";
import Fieldset from "@peated/web/components/fieldset";
import PasskeyManager from "@peated/web/components/passkeyManager";
import TextField from "@peated/web/components/textField";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useState } from "react";

export default function SecuritySettingsPage() {
  useAuthRequired();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passkeysOpen, setPasskeysOpen] = useState(true);

  return (
    <>
      <Fieldset>
        <button
          onClick={() => setPasswordOpen(!passwordOpen)}
          className="flex w-full items-center justify-between py-4 text-left"
          type="button"
        >
          <div>
            <h3 className="text-lg font-medium">Password</h3>
            <p className="text-muted text-sm">Change your account password</p>
          </div>
          {passwordOpen ? (
            <ChevronUpIcon className="text-muted h-5 w-5" />
          ) : (
            <ChevronDownIcon className="text-muted h-5 w-5" />
          )}
        </button>

        <Collapsable open={passwordOpen}>
          <div className="space-y-4 pb-4">
            <TextField
              type="password"
              label="Current Password"
              placeholder="Enter current password"
            />
            <TextField
              type="password"
              label="New Password"
              placeholder="Enter new password"
            />
            <TextField
              type="password"
              label="Confirm New Password"
              placeholder="Confirm new password"
            />
            {/* TODO: Implement password change functionality */}
          </div>
        </Collapsable>
      </Fieldset>

      <Fieldset>
        <button
          onClick={() => setPasskeysOpen(!passkeysOpen)}
          className="flex w-full items-center justify-between py-4 text-left"
          type="button"
        >
          <div>
            <h3 className="text-lg font-medium">Passkeys</h3>
            <p className="text-muted text-sm">
              Use biometric authentication or security keys to sign in
            </p>
          </div>
          {passkeysOpen ? (
            <ChevronUpIcon className="text-muted h-5 w-5" />
          ) : (
            <ChevronDownIcon className="text-muted h-5 w-5" />
          )}
        </button>

        <Collapsable open={passkeysOpen}>
          <div className="pb-4">
            <PasskeyManager />
          </div>
        </Collapsable>
      </Fieldset>
    </>
  );
}
