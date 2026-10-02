import {
  createServer,
  type AddressInfo,
  type Server,
  type Socket,
} from "node:net";
import { Protocol } from "../protocol/Protocol.js";

export interface TcpServerOptions {
  host: string;
  port: number;
  onMessage: (message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  log?: (message: string) => void;
}

export class TcpServer {
  private readonly server: Server;
  private readonly clients = new Set<Socket>();
  private readonly buffers = new Map<Socket, string>();
  private readonly protocol = new Protocol();
  private readonly log: (message: string) => void;

  constructor(private readonly options: TcpServerOptions) {
    this.log = options.log ?? console.log;
    this.server = createServer((socket) => this.handleConnection(socket));
    this.server.on("error", (error) => {
      this.log(`TCP server error: ${error.message}`);
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      this.server.once("error", onError);
      this.server.listen(this.options.port, this.options.host, () => {
        this.server.off("error", onError);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      for (const client of this.clients) {
        client.destroy();
      }

      if (!this.server.listening) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  address(): AddressInfo | string | null {
    return this.server.address();
  }

  get isConnected(): boolean {
    return this.clients.size > 0;
  }

  send(message: string): void {
    const encodedMessage = this.protocol.encode(message);
    for (const client of this.clients) {
      if (client.writable) {
        client.write(encodedMessage);
      }
    }
  }

  private handleConnection(socket: Socket): void {
    this.clients.add(socket);
    this.buffers.set(socket, "");
    this.options.onConnectionChange?.(true);
    this.log(`[CONNECTED] Agent ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on("data", (chunk: Buffer) => {
      const pending = `${this.buffers.get(socket) ?? ""}${chunk.toString("utf8")}`;
      const lines = pending.split("\n");
      this.buffers.set(socket, lines.pop() ?? "");

      for (const line of lines) {
        this.options.onMessage(this.protocol.decode(line));
      }
    });

    socket.on("close", () => {
      this.clients.delete(socket);
      this.buffers.delete(socket);
      this.options.onConnectionChange?.(this.clients.size > 0);
      this.log("[DISCONNECTED] Agent");
    });

    socket.on("error", (error) => {
      this.log(`TCP client error: ${error.message}`);
    });
  }
}
