import { describe, expect, it } from "vitest";
import { Turnstile } from "../src/turnstile/Turnstile.js";
import { TurnstileState } from "../src/turnstile/TurnstileState.js";

describe("Turnstile", () => {
  it("starts locked", () => {
    expect(new Turnstile().status()).toBe(TurnstileState.Locked);
  });

  it("supports valid open, close, lock, and unlock transitions", () => {
    const turnstile = new Turnstile();

    expect(turnstile.unlock()).toEqual([TurnstileState.Unlocked]);
    expect(turnstile.open()).toEqual([TurnstileState.Open]);
    expect(turnstile.close()).toEqual([TurnstileState.Closed]);
    expect(turnstile.lock()).toEqual([TurnstileState.Locked]);
  });

  it("rejects invalid transitions", () => {
    const turnstile = new Turnstile();

    expect(turnstile.open()).toEqual([]);
    expect(turnstile.close()).toEqual([]);
    expect(turnstile.lock()).toEqual([]);
    expect(turnstile.status()).toBe(TurnstileState.Locked);
  });

  it("resets to locked", () => {
    const turnstile = new Turnstile();
    turnstile.authorize("123");

    expect(turnstile.reset()).toEqual([TurnstileState.Locked]);
    expect(turnstile.status()).toBe(TurnstileState.Locked);
  });

  it("authorizes and records one passage for the matching user", () => {
    const turnstile = new Turnstile();

    expect(turnstile.authorize("123")).toEqual([
      TurnstileState.Unlocked,
      TurnstileState.Open,
    ]);
    expect(turnstile.passage("456")).toBe(false);
    expect(turnstile.passage("123")).toBe(true);
    expect(turnstile.passage("123")).toBe(false);
  });

  it("keeps the turnstile locked after denial", () => {
    const turnstile = new Turnstile();

    expect(turnstile.deny("123")).toEqual([]);
    expect(turnstile.status()).toBe(TurnstileState.Locked);
  });
});
