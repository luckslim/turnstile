import type { TurnstileCommand } from "../turnstile/TurnstileCommand.js";

export interface ProtocolMessage {
  command: TurnstileCommand;
  userId?: string;
}

export class Protocol {
  private readonly commandsWithUserId = new Set<TurnstileCommand>([
    "AUTH",
    "AUTH_REQUEST",
    "ALLOW",
    "DENY",
    "PASSAGE",
  ]);
  private readonly commandsWithoutUserId = new Set<TurnstileCommand>([
    "OPEN",
    "CLOSE",
    "LOCK",
    "UNLOCK",
    "STATUS",
    "RESET",
    "PING",
  ]);

  encode(message: string): string {
    return `${message}\n`;
  }

  decode(message: string): string {
    return message.endsWith("\r") ? message.slice(0, -1) : message;
  }

  parse(message: string): ProtocolMessage | null {
    const decodedMessage = this.decode(message);
    if (!decodedMessage || decodedMessage.trim() !== decodedMessage) {
      return null;
    }

    const separator = decodedMessage.indexOf("|");
    if (separator === -1) {
      if (this.commandsWithoutUserId.has(decodedMessage as TurnstileCommand)) {
        return { command: decodedMessage as TurnstileCommand };
      }
      return null;
    }

    if (
      separator !== decodedMessage.lastIndexOf("|") ||
      separator === decodedMessage.length - 1
    ) {
      return null;
    }

    const command = decodedMessage.slice(0, separator) as TurnstileCommand;
    if (!this.commandsWithUserId.has(command)) {
      return null;
    }

    return {
      command,
      userId: decodedMessage.slice(separator + 1),
    };
  }
}
