/** A byte stream with line and fixed-length reads, shared by the SMTP and IMAP clients. */
export interface Wire {
  readLine(): Promise<string>;
  readBytes(length: number): Promise<Uint8Array>;
  write(text: string): Promise<void>;
  close(): Promise<void>;
}

/** How long one read, write or connect may take before the connection is dropped. */
export const WIRE_TIMEOUT_MS = 20_000;
// A server line without CRLF past this size is broken or hostile.
const MAX_LINE_BYTES = 1_048_576;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Rejects when `promise` takes longer than `ms`, after running `onTimeout`
 * (which closes the socket, so the pending read or write is abandoned).
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => Promise<void> | void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Tempo esgotado na conexão com o servidor de e-mail"));
      void Promise.resolve()
        .then(onTimeout)
        .catch(() => {});
    }, ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Wraps a readable/writable byte pair (a TCP socket in production, a fake in tests). */
export function createWire(
  readable: ReadableStream<Uint8Array>,
  writable: WritableStream<Uint8Array>,
  onClose: () => Promise<void> = async () => {},
  timeoutMs = WIRE_TIMEOUT_MS,
): Wire {
  const reader = readable.getReader();
  const writer = writable.getWriter();
  // Received bytes live in buffer[start, end); it grows by doubling, so a large
  // literal costs linear copies instead of one full copy per chunk.
  let buffer = new Uint8Array(4096);
  let start = 0;
  let end = 0;
  // How far readLine already looked for CRLF, so a long line is scanned once.
  let scanned = 0;
  let closed = false;
  let failure: Error | undefined;

  async function shutdown() {
    if (closed) return;
    closed = true;
    try {
      reader.releaseLock();
      writer.releaseLock();
    } catch {
      // A pending read or write keeps the lock; closing the socket ends it anyway.
    } finally {
      await onClose();
    }
  }

  // Every operation gets its own deadline; after a timeout the wire stays failed.
  async function guarded<T>(operation: () => Promise<T>): Promise<T> {
    if (failure) throw failure;
    try {
      return await withDeadline(operation(), timeoutMs, shutdown);
    } catch (error) {
      failure ??= error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  function append(value: Uint8Array) {
    if (end + value.length > buffer.length) {
      // Out of room at the tail: move the unread bytes to the front, growing if needed.
      const length = end - start;
      let capacity = buffer.length;
      while (capacity < length + value.length) capacity *= 2;
      if (capacity === buffer.length) {
        buffer.copyWithin(0, start, end);
      } else {
        const next = new Uint8Array(capacity);
        next.set(buffer.subarray(start, end));
        buffer = next;
      }
      scanned -= start;
      start = 0;
      end = length;
    }
    buffer.set(value, end);
    end += value.length;
  }

  const buffered = () => end - start;

  async function fill(): Promise<void> {
    const { value, done } = await reader.read();
    if (done || !value) throw new Error("Conexão encerrada pelo servidor de e-mail");
    append(value);
  }

  return {
    readLine: () =>
      guarded(async () => {
        for (;;) {
          for (let i = Math.max(start, scanned); i < end - 1; i++) {
            if (buffer[i] === 13 && buffer[i + 1] === 10) {
              const line = decoder.decode(buffer.subarray(start, i));
              start = i + 2;
              scanned = start;
              return line;
            }
          }
          scanned = Math.max(start, end - 1);
          if (end - start > MAX_LINE_BYTES) {
            throw new Error("Resposta inválida do servidor de e-mail");
          }
          await fill();
        }
      }),
    readBytes: (length) =>
      guarded(async () => {
        // fill() moves `end`; the loop condition reads it through buffered().
        while (buffered() < length) await fill();
        const bytes = buffer.slice(start, start + length);
        start += length;
        scanned = Math.max(scanned, start);
        return bytes;
      }),
    write: (text) => guarded(() => writer.write(encoder.encode(text))),
    close: shutdown,
  };
}

/** Opens an implicit-TLS TCP connection from the Worker (ports 465 and 993). */
export async function connectTls(
  hostname: string,
  port: number,
  timeoutMs = WIRE_TIMEOUT_MS,
): Promise<Wire> {
  const { connect } = await import("cloudflare:sockets");
  const socket = connect({ hostname, port }, { secureTransport: "on", allowHalfOpen: false });
  const close = () => socket.close().catch(() => {});
  try {
    await withDeadline(socket.opened, timeoutMs, close);
  } catch (error) {
    await close();
    throw error;
  }
  return createWire(socket.readable, socket.writable, () => socket.close(), timeoutMs);
}
