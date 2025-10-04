"use client";

import React from "react";

type Props = {
  length?: number;
  name?: string;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
};

export default function OTPInput({
  length = 6,
  name = "code",
  autoFocus,
  onChange,
}: Props) {
  const [values, setValues] = React.useState<string[]>(Array(length).fill(""));
  const refs = React.useRef<Array<HTMLInputElement | null>>(
    Array(length).fill(null),
  );

  const focusIndex = (i: number) => {
    if (i >= 0 && i < length) refs.current[i]?.focus();
  };

  const setChar = (i: number, ch: string) => {
    const v = ch.replace(/\D/g, "").slice(0, 1);
    const next = values.slice();
    next[i] = v;
    setValues(next);
    onChange?.(next.join(""));
    if (v && i < length - 1) focusIndex(i + 1);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    const next = Array(length)
      .fill("")
      .map((_, i) => text[i] || "");
    setValues(next);
    onChange?.(next.join(""));
    // move focus to end or first empty
    const last = Math.min(text.length, length) - 1;
    focusIndex(last >= 0 ? last : 0);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const target = e.target as HTMLInputElement;
    const idx = Number(target.dataset.index);
    if (e.key === "Backspace") {
      if (values[idx]) {
        const next = values.slice();
        next[idx] = "";
        setValues(next);
        onChange?.(next.join(""));
      } else if (idx > 0) {
        focusIndex(idx - 1);
      }
    } else if (e.key === "ArrowLeft") {
      focusIndex(idx - 1);
    } else if (e.key === "ArrowRight") {
      focusIndex(idx + 1);
    }
  };

  const joined = values.join("");

  return (
    <div className="flex w-full flex-col items-center gap-y-2">
      <input type="hidden" name={name} value={joined} />
      <div
        className="grid w-full gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {values.map((val, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={1}
            value={val}
            onChange={(e) => setChar(i, e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            className="focus:border-highlight h-12 w-full rounded-md border-2 border-slate-700 bg-slate-900 text-center text-xl tracking-widest focus:outline-none"
            {...(autoFocus && i === 0 ? { autoFocus: true } : {})}
          />
        ))}
      </div>
    </div>
  );
}
