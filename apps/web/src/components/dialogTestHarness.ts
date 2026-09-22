import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/** Mounts a component that opens a headless-ui dialog into document.body. */
export function mountDialog() {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  return {
    root,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

// React tracks the value through the element prototype's setter, so setting
// the value on the prototype with the element as receiver lets React see the
// change when the event fires.
function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  Reflect.set(Object.getPrototypeOf(element), "value", value, element);
}

/** Types into a controlled input or textarea the way React expects. */
export function typeInto(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  act(() => {
    setNativeValue(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Chooses an option in a controlled select. */
export function selectOption(element: HTMLSelectElement, value: string) {
  act(() => {
    setNativeValue(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function findByLabel<T extends HTMLElement>(label: string): T {
  const labelElement = Array.from(document.querySelectorAll("label")).find(
    (candidate) => candidate.textContent === label,
  );
  const id = labelElement?.getAttribute("for");
  const element = id ? document.getElementById(id) : null;
  if (!element) throw new Error(`No field labeled ${label}`);
  // SAFETY: the caller names the control type that the labeled field renders;
  // a wrong type fails loudly in the test that asked for it.
  return element as T;
}

export function findButton(name: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === name,
  );
  if (!button) throw new Error(`No button named ${name}`);
  return button;
}

/** Waits for pending promises and React updates after an async submit. */
export async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
