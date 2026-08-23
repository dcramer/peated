// MIT License

// Copyright (c) 2023 Alex Johansson

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// https://github.com/trpc/trpc/blob/67c093749590628118cbb68e8de52c15e4a7b126/packages/tests/server/___testHelpers.ts#L148C23-L177
import { z } from "zod";

type ErrorConstructor<TError extends Error> = new (...args: never[]) => TError;

export default function waitError<TResult>(
  fnOrPromise: Promise<TResult> | (() => TResult | Promise<TResult>),
): Promise<Error>;
export default function waitError<TResult, TError extends Error>(
  fnOrPromise: Promise<TResult> | (() => TResult | Promise<TResult>),
  errorConstructor: ErrorConstructor<TError>,
): Promise<TError>;
export default async function waitError<TResult>(
  /**
   * Function callback or promise that you expect will throw
   */
  fnOrPromise: Promise<TResult> | (() => TResult | Promise<TResult>),
  /**
   * Force error constructor to be of specific type
   * @default Error
   **/
  errorConstructor?: ErrorConstructor<Error>,
): Promise<Error> {
  let res;
  try {
    const callback = z
      .custom<
        () => TResult | Promise<TResult>
      >((value) => value instanceof Function)
      .safeParse(fnOrPromise);
    if (callback.success) {
      res = await callback.data();
    } else {
      res = await fnOrPromise;
    }
  } catch (cause) {
    if (!(cause instanceof Error)) {
      throw new Error("Expected an Error to be thrown.", { cause });
    }
    const causeName = cause.name;
    if (errorConstructor && !(cause instanceof errorConstructor)) {
      throw new Error(
        `Expected ${errorConstructor.name}, but received ${causeName}.`,
        { cause },
      );
    }
    return cause;
  }

  // eslint-disable-next-line no-console
  console.warn("Expected function to throw, but it did not. Result:", res);
  throw new Error("Function did not throw");
}
