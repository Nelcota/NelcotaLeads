/** A byte stream with line and fixed-length reads, shared by the SMTP and IMAP clients. */
export interface Wire {
  readLine(): Promise<string>;
  readBytes(length: number): Promise<Uint8Array>;
  write(text: string): Promise<void>;
  close(): Promise<void>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Wraps a readable/writable byte pair (a TCP socket in production, a fake in tests). */
export function createWire(
  readable: ReadableStream<Uint8Array>,
  writable: WritableStream<Uint8Array>,
  onClose: () => Promise<void> = async () => {},
): Wire {
  const reader = readable.getReader();
  const writer = writable.getWriter();
  let buffer = new Uint8Array(0);

  async function fill(): Promise<void> {
    const { value, done } = await reader.read();
    if (done || !value) throw new Error("Conexão encerrada pelo servidor de e-mail");
    const next = new Uint8Array(buffer.length + value.length);
    next.set(buffer);
    next.set(value, buffer.length);
    buffer = next;
  }

  return {
    async readLine() {
      for (;;) {
        const end = indexOfCrlf(buffer);
        if (end >= 0) {
          const line = decoder.decode(buffer.subarray(0, end));
          buffer = buffer.slice(end + 2);
          return line;
        }
        await fill();
      }
    },
    async readBytes(length) {
      while (buffer.length < length) await fill();
      const bytes = buffer.slice(0, length);
      buffer = buffer.slice(length);
      return bytes;
    },
    async write(text) {
      await writer.write(encoder.encode(text));
    },
    async close() {
      try {
        reader.releaseLock();
        writer.releaseLock();
      } finally {
        await onClose();
      }
    },
  };
}

function indexOfCrlf(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10) return i;
  }
  return -1;
}

/** Opens an implicit-TLS TCP connection from the Worker (ports 465 and 993). */
export async function connectTls(hostname: string, port: number): Promise<Wire> {
  const { connect } = await import("cloudflare:sockets");
  const socket = connect({ hostname, port }, { secureTransport: "on", allowHalfOpen: false });
  await socket.opened;
  return createWire(socket.readable, socket.writable, () => socket.close());
}
