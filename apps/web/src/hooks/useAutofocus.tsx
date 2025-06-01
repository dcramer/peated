import { useEffect, useRef } from "react";

export default function useAutofocus<ElementType extends HTMLElement>(
  condition?: () => boolean
) {
  const ref = useRef<ElementType>(null);
  useEffect(() => {
    let shouldFocus = true;
    if (condition) {
      shouldFocus = condition();
    }
    if (!shouldFocus) return;
    const node = ref.current;
    if (node && typeof node.focus === "function") {
      node.focus();
    }
  }, [ref, condition]);
  return ref;
}
