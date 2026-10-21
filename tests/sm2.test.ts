import { describe, expect, it } from "vitest";
import { easeDelta, initialSm2State, MIN_EASE_FACTOR, nextEaseFactor, sm2, type Quality, type Sm2State } from "@/lib/srs/sm2";

const run = (grades: Quality[], start: Sm2State = initialSm2State()) =>
  grades.reduce<Sm2State[]>((states, q) => [...states, sm2(states[states.length - 1], q)], [start]).slice(1);

describe("SM-2 ease factor", () => {
  it("applies the published deltas for q = 5 … 0", () => {
    expect([5, 4, 3, 2, 1, 0].map((q) => Number(easeDelta(q as Quality).toFixed(2)))).toEqual([0.1, 0, -0.14, -0.32, -0.54, -0.8]);
  });

  it("never drops below 1.3", () => {
    let ef = 2.5;
    for (let i = 0; i < 20; i += 1) ef = nextEaseFactor(ef, 0);
    expect(ef).toBe(MIN_EASE_FACTOR);
  });

  it("stays free of floating-point drift", () => {
    expect(nextEaseFactor(2.5, 3)).toBe(2.36);
    expect(nextEaseFactor(2.36, 3)).toBe(2.22);
    expect(nextEaseFactor(2.22, 5)).toBe(2.32);
  });
});

describe("SM-2 intervals", () => {
  it("follows 1, 6, then ceil(I × EF) for steady q = 4 answers", () => {
    expect(run([4, 4, 4, 4, 4]).map((s) => s.interval)).toEqual([1, 6, 15, 38, 95]);
  });

  it("grows faster for q = 5 because the ease factor rises", () => {
    const states = run([5, 5, 5, 5]);
    expect(states.map((s) => s.easeFactor)).toEqual([2.6, 2.7, 2.8, 2.9]);
    // The interval uses the EF from before each review: 6 × 2.7 = 16.2 → 17, 17 × 2.8 = 47.6 → 48.
    expect(states.map((s) => s.interval)).toEqual([1, 6, 17, 48]);
  });

  it("rounds fractional intervals up", () => {
    const [, , third] = run([3, 3, 3]);
    // EF after two q = 3 answers is 2.22, so 6 × 2.22 = 13.32 → 14.
    expect(third.interval).toBe(14);
  });

  it("restarts repetitions after a lapse but keeps the lowered ease factor", () => {
    const [, , , lapse, relearn1, relearn2] = run([4, 4, 4, 1, 4, 4]);
    expect(lapse).toEqual({ repetitions: 0, interval: 1, easeFactor: 1.96 });
    expect(relearn1.interval).toBe(1);
    expect(relearn2.interval).toBe(6);
    expect(relearn2.easeFactor).toBe(1.96);
  });

  it("treats q = 3 as correct and q = 2 as incorrect", () => {
    expect(sm2(initialSm2State(), 3).repetitions).toBe(1);
    expect(sm2({ repetitions: 3, easeFactor: 2.5, interval: 15 }, 2)).toEqual({ repetitions: 0, interval: 1, easeFactor: 2.18 });
  });

  it("is pure and rejects invalid grades", () => {
    const state = Object.freeze({ repetitions: 2, easeFactor: 2.5, interval: 6 });
    expect(() => sm2(state, 4)).not.toThrow();
    expect(state.interval).toBe(6);
    expect(() => sm2(state, 6 as Quality)).toThrow(RangeError);
    expect(() => sm2(state, 2.5 as Quality)).toThrow(RangeError);
  });
});
