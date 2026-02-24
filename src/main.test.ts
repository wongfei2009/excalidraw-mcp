import { describe, expect, it, vi } from "vitest";

import { startStdioServer } from "./main";

describe("startStdioServer", () => {
  it("connects to stdio transport", async () => {
    const connect = vi.fn(async () => {});

    await startStdioServer(() => ({ connect }) as any);

    expect(connect).toHaveBeenCalledTimes(1);
  });
});
