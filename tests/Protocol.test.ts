import { describe, expect, it } from "vitest";
import { Protocol } from "../src/protocol/Protocol.js";

describe("Protocol", () => {
  const protocol = new Protocol();

  it.each([
    ["AUTH|123", "AUTH", "123"],
    ["ALLOW|123", "ALLOW", "123"],
    ["DENY|123", "DENY", "123"],
    ["OPEN", "OPEN", undefined],
    ["CLOSE", "CLOSE", undefined],
    ["LOCK", "LOCK", undefined],
    ["UNLOCK", "UNLOCK", undefined],
    ["STATUS", "STATUS", undefined],
    ["PASSAGE|123", "PASSAGE", "123"],
  ])("parses %s", (input, command, userId) => {
    expect(protocol.parse(input)).toEqual({
      command,
      ...(userId ? { userId } : {}),
    });
    expect(protocol.decode(input)).toBe(input);
    expect(protocol.encode(input)).toBe(`${input}\n`);
  });

  it.each([
    ["empty message", ""],
    ["invalid message", "AUTH|123|extra"],
    ["unknown command", "UNKNOWN"],
    ["missing identifier", "AUTH|"],
    ["missing identifier separator", "AUTH"],
  ])("rejects %s", (_description, input) => {
    expect(protocol.parse(input)).toBeNull();
  });
});
