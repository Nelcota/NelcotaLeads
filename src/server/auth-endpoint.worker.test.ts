import { describe, expect, it } from "vitest";
import { MAX_AUTH_BODY_BYTES, readLimitedBody } from "./auth-endpoint";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://app.test/api/login", { method: "POST", body, headers });

/** A body of `size` bytes sent without Content-Length, so only the read itself can stop it. */
function streamed(size: number) {
  const chunk = new Uint8Array(1024);
  let left = size;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (left <= 0) return controller.close();
      const next = chunk.subarray(0, Math.min(chunk.length, left));
      left -= next.length;
      controller.enqueue(next);
    },
  });
}

describe("readLimitedBody", () => {
  it("reads a body up to the limit, inclusive", async () => {
    const bytes = await readLimitedBody(post("a".repeat(MAX_AUTH_BODY_BYTES)), MAX_AUTH_BODY_BYTES);
    expect(bytes?.length).toBe(MAX_AUTH_BODY_BYTES);
    expect((await readLimitedBody(post(""), MAX_AUTH_BODY_BYTES))?.length).toBe(0);
  });

  it("refuses one byte past the limit, declared or streamed", async () => {
    expect(
      await readLimitedBody(post("a".repeat(MAX_AUTH_BODY_BYTES + 1)), MAX_AUTH_BODY_BYTES),
    ).toBeNull();
    expect(
      await readLimitedBody(post(streamed(MAX_AUTH_BODY_BYTES + 1)), MAX_AUTH_BODY_BYTES),
    ).toBeNull();
    expect(await readLimitedBody(post(streamed(50 * 1024 * 1024)), MAX_AUTH_BODY_BYTES)).toBeNull();
  });

  it("refuses a Content-Length it cannot trust", async () => {
    const lying = post("x", { "Content-Length": "999999999999" });
    expect(await readLimitedBody(lying, MAX_AUTH_BODY_BYTES)).toBeNull();
  });
});
