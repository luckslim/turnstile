import { TcpServer } from "./tcp/TcpServer.js";
import { Turnstile } from "./turnstile/Turnstile.js";
import { TurnstileState } from "./turnstile/TurnstileState.js";
import { Protocol } from "./protocol/Protocol.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5000);
const deviceId = process.env.DEVICE_ID ?? "turnstile-01";

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}

const turnstile = new Turnstile();
const protocol = new Protocol();
const readline = createInterface({ input: stdin, output: stdout });
let resolveAccess:
  | ((result: "ALLOW" | "DENY" | "DISCONNECTED") => void)
  | undefined;
let pendingUserId: string | undefined;

const tcpServer = new TcpServer({
  host,
  port,
  onMessage: handleAgentMessage,
  onConnectionChange: (connected) => {
    if (!connected && resolveAccess) {
      resolveAccess("DISCONNECTED");
      resolveAccess = undefined;
      pendingUserId = undefined;
    }
  },
});

function send(message: string): void {
  console.log(`[SENT] ${message}`);
  tcpServer.send(message);
}

function reportStates(states: TurnstileState[]): void {
  for (const state of states) {
    console.log(`[STATE] ${state}`);
  }
}

function displayMenu(): void {
  console.log(`TCP: ${host}:${port}`);
  console.log(`State: ${turnstile.status()}\n`);
  console.log("Commands:\n");
  console.log("1 - Simulate access");
  console.log("2 - Open");
  console.log("3 - Close");
  console.log("4 - Lock");
  console.log("5 - Unlock");
  console.log("6 - Status");
  console.log("7 - Exit");
}

function handleAgentMessage(message: string): void {
  console.log(`[RECEIVED] ${message}`);
  const parsedMessage = protocol.parse(message);
  if (!parsedMessage) {
    console.log(`[ERROR] Invalid message: ${message}`);
    return;
  }

  const { command, userId = "" } = parsedMessage;

  if (command === "AUTH") {
    send(`AUTH_REQUEST|${userId}`);
    return;
  }

  if (command === "PASSAGE") {
    if (!turnstile.passage(userId)) {
      console.log(`[ERROR] Passage rejected: ${userId}`);
      return;
    }
    send(`PASSAGE|${userId}`);
    reportStates([...turnstile.close(), ...turnstile.lock()]);
    return;
  }

  if (command !== "ALLOW" && command !== "DENY") {
    if (command === "OPEN") {
      reportStates(turnstile.open());
    } else if (command === "CLOSE") {
      reportStates(turnstile.close());
    } else if (command === "LOCK") {
      reportStates(turnstile.lock());
    } else if (command === "UNLOCK") {
      reportStates(turnstile.unlock());
    } else if (command === "STATUS") {
      reportStates([turnstile.status()]);
    } else if (command === "RESET") {
      reportStates(turnstile.reset());
    }
    return;
  }

  if (resolveAccess && userId !== pendingUserId) {
    console.log(`[ERROR] No matching access request for ${userId}`);
    return;
  }

  if (command === "ALLOW") {
    const changes = turnstile.authorize(userId);
    reportStates(changes);
    if (resolveAccess) {
      const resolve = resolveAccess;
      resolveAccess = undefined;
      pendingUserId = undefined;
      console.log(`Access granted: ${userId}`);
      console.log("Turnstile unlocked");
      console.log("Turnstile opened");
      resolve("ALLOW");
    }
    return;
  }

  if (!resolveAccess) {
    reportStates(turnstile.deny(userId));
    return;
  }

  const resolve = resolveAccess;
  resolveAccess = undefined;
  pendingUserId = undefined;
  turnstile.deny(userId);
  console.log(`Access denied: ${userId}`);
  console.log("Turnstile remains locked");
  resolve("DENY");
}

async function simulateAccess(): Promise<void> {
  const userId = (await readline.question("User ID: ")).trim();
  if (!userId) {
    console.log("User ID is required");
    return;
  }

  if (!tcpServer.isConnected) {
    console.log("Agent is not connected");
    return;
  }

  pendingUserId = userId;
  const accessResult = new Promise<"ALLOW" | "DENY" | "DISCONNECTED">(
    (resolve) => {
      resolveAccess = resolve;
    },
  );
  send(`AUTH|${userId}`);

  const result = await accessResult;
  if (result !== "ALLOW") {
    if (result === "DISCONNECTED") {
      console.log("Agent disconnected before responding");
    }
    return;
  }

  const passageCommand = await readline.question(
    "Type PASSAGE to simulate passage: ",
  );
  if (passageCommand.trim() !== "PASSAGE") {
    return;
  }

  if (!tcpServer.isConnected) {
    console.log("Agent is not connected");
    return;
  }

  if (turnstile.passage(userId)) {
    send(`PASSAGE|${userId}`);
    console.log(`Passage recorded: ${userId}`);
    turnstile.close();
    console.log("Turnstile closed");
    turnstile.lock();
    console.log("Turnstile locked");
  }
}

async function runCli(): Promise<void> {
  let running = true;
  readline.on("SIGINT", () => readline.close());

  while (running) {
    displayMenu();
    let command: string;
    try {
      command = await readline.question("\nSelect command: ");
    } catch {
      break;
    }

    switch (command.trim()) {
      case "1":
        await simulateAccess();
        break;
      case "2": {
        if (
          turnstile.status() === TurnstileState.Locked ||
          turnstile.status() === TurnstileState.Closed
        ) {
          turnstile.unlock();
        }
        if (turnstile.open().length > 0) {
          console.log("Turnstile opened");
        }
        break;
      }
      case "3":
        if (turnstile.close().length > 0) {
          console.log("Turnstile closed");
        }
        break;
      case "4":
        if (turnstile.status() === TurnstileState.Open) {
          console.log("Close the turnstile before locking");
        } else if (turnstile.status() === TurnstileState.Unlocked) {
          turnstile.close();
          turnstile.lock();
          console.log("Turnstile locked");
        } else if (turnstile.lock().length > 0) {
          console.log("Turnstile locked");
        }
        break;
      case "5":
        if (turnstile.unlock().length > 0) {
          console.log("Turnstile unlocked");
        }
        break;
      case "6":
        console.log(`State: ${turnstile.status()}`);
        break;
      case "7":
        running = false;
        readline.close();
        break;
      default:
        console.log("Invalid command");
    }
    console.log();
  }

  readline.close();
  await tcpServer.stop();
}

try {
  await tcpServer.start();
  console.log("==============================");
  console.log("      TURNSTILE EMULATOR");
  console.log("==============================\n");
  console.log(`Device: ${deviceId}`);
  console.log(`TCP: ${host}:${port}`);
  console.log(`State: ${turnstile.status()}\n`);
  console.log("Waiting for Agent...\n");
  await runCli();
} catch (error) {
  console.error(`Could not start TCP server: ${String(error)}`);
  process.exitCode = 1;
}
