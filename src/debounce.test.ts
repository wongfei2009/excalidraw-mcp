import { describe, expect, it, vi } from "vitest";
import { createDebouncedCallback } from "./debounce";

describe("createDebouncedCallback", () => {
  it("runs only the latest scheduled call", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = createDebouncedCallback(spy, 100);

    debounced.trigger("first");
    debounced.trigger("second");
    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("second");
    vi.useRealTimers();
  });

  it("cancels pending work", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = createDebouncedCallback(spy, 100);

    debounced.trigger("value");
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
