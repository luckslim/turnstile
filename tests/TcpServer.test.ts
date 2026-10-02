import { once } from "node:events";
import { connect, type Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { Protocol } from "../src/protocol/Protocol.js";
import { TcpServer } from "../src/tcp/TcpServer.js";
import { Turnstile } from "../src/turnstile/Turnstile.js";
import { TurnstileState } from "../src/turnstile/TurnstileState.js";

function readLine(socket: Socket): Promise<string> {
  return new Promise((resolve) => {
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex !== -1) {
        socket.off("data", onData);
        resolve(buffer.slice(0, newlineIndex));
      }
    };
    socket.on("data", onData);
  });
}

describe("TCP server", () => {
  it("responds to AUTH and applies ALLOW over one local connection", async () => {
    const protocol = new Protocol();
    const turnstile = new Turnstile();
    let tcpServer: TcpServer;
    let resolveAllow: () => void = () => undefined;
    const allowed = new Promise<void>((resolve) => {
      resolveAllow = resolve;
    });

    tcpServer = new TcpServer({
      host: "127.0.0.1",
      port: 0,
      onMessage: (message) => {
        const parsed = protocol.parse(message);
        if (!parsed) {
          return;
        }
        if (parsed.command === "AUTH") {
          tcpServer.send(`AUTH_REQUEST|${parsed.userId}`);
        } else if (parsed.command === "ALLOW" && parsed.userId) {
          turnstile.authorize(parsed.userId);
          resolveAllow();
        }
      },
      log: () => undefined,
    });

    await tcpServer.start();
    const address = tcpServer.address();
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe("string");
    if (!address || typeof address === "string") {
      throw new Error("TCP server did not provide its bound address");
    }

    const client = connect(address.port, "127.0.0.1");
    await once(client, "connect");

    try {
      client.write("AUTH|123\n");
      await expect(readLine(client)).resolves.toBe("AUTH_REQUEST|123");

      client.write("ALLOW|123\n");
      await allowed;
      expect(turnstile.status()).toBe(TurnstileState.Open);
    } finally {
      client.destroy();
      await tcpServer.stop();
    }
  });
});
