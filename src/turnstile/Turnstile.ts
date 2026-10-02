import { TurnstileState } from "./TurnstileState.js";

export class Turnstile {
  private currentState = TurnstileState.Locked;
  private authorizedUserId: string | null = null;

  open(): TurnstileState[] {
    return this.changeState(TurnstileState.Open, [TurnstileState.Unlocked]);
  }

  close(): TurnstileState[] {
    const changes = this.changeState(TurnstileState.Closed, [
      TurnstileState.Open,
      TurnstileState.Unlocked,
    ]);
    if (changes.length > 0) {
      this.authorizedUserId = null;
    }
    return changes;
  }

  lock(): TurnstileState[] {
    const changes = this.changeState(TurnstileState.Locked, [
      TurnstileState.Closed,
    ]);
    if (changes.length > 0) {
      this.authorizedUserId = null;
    }
    return changes;
  }

  unlock(): TurnstileState[] {
    return this.changeState(TurnstileState.Unlocked, [
      TurnstileState.Locked,
      TurnstileState.Closed,
    ]);
  }

  authorize(userId: string): TurnstileState[] {
    if (!userId || this.currentState === TurnstileState.Open) {
      return [];
    }

    this.authorizedUserId = userId;
    return [...this.unlock(), ...this.open()];
  }

  deny(userId: string): TurnstileState[] {
    if (
      this.authorizedUserId === userId ||
      this.currentState !== TurnstileState.Locked
    ) {
      this.authorizedUserId = null;
    }

    const changes: TurnstileState[] = [];
    if (
      this.currentState === TurnstileState.Open ||
      this.currentState === TurnstileState.Unlocked
    ) {
      changes.push(...this.close());
    }
    if (this.currentState === TurnstileState.Closed) {
      changes.push(...this.lock());
    }
    return changes;
  }

  passage(userId: string): boolean {
    if (
      this.currentState !== TurnstileState.Open ||
      this.authorizedUserId !== userId
    ) {
      return false;
    }

    this.authorizedUserId = null;
    return true;
  }

  status(): TurnstileState {
    return this.currentState;
  }

  reset(): TurnstileState[] {
    this.authorizedUserId = null;
    if (this.currentState === TurnstileState.Locked) {
      return [];
    }

    this.currentState = TurnstileState.Locked;
    return [TurnstileState.Locked];
  }

  private changeState(
    nextState: TurnstileState,
    allowedFrom: TurnstileState[],
  ): TurnstileState[] {
    if (!allowedFrom.includes(this.currentState)) {
      return [];
    }

    this.currentState = nextState;
    return [nextState];
  }
}
