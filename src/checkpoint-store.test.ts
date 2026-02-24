import { describe, expect, it } from "vitest";
import { MemoryCheckpointStore } from "./checkpoint-store";

describe("MemoryCheckpointStore", () => {
  it("saves and loads checkpoints", async () => {
    const store = new MemoryCheckpointStore();
    const payload = {
      elements: [{ id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 60 }],
    };

    await store.save("cp_ok", payload);
    await expect(store.load("cp_ok")).resolves.toEqual(payload);
  });

  it("rejects invalid checkpoint ids", async () => {
    const store = new MemoryCheckpointStore();
    await expect(store.save("../../bad", { elements: [] })).rejects.toThrow(
      /Invalid checkpoint id/,
    );
  });

  it("rejects oversized UTF-8 payloads", async () => {
    const store = new MemoryCheckpointStore();
    const payload = {
      elements: [
        { id: "t1", type: "text", x: 0, y: 0, width: 1, height: 1, text: "😀".repeat(1_400_000) },
      ],
    };

    await expect(store.save("cp_big", payload)).rejects.toThrow(/exceeds/i);
  });
});
