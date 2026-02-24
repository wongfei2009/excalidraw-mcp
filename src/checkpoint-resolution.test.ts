import { describe, expect, it } from "vitest";
import { resolveElementsForCheckpoint } from "./checkpoint-resolution";

describe("resolveElementsForCheckpoint", () => {
  it("applies delete ids for fresh create payloads", () => {
    const parsed = [
      { type: "rectangle", id: "r1", x: 0, y: 0, width: 100, height: 60 },
      { type: "text", id: "t1", containerId: "r1", x: 10, y: 10, width: 30, height: 20 },
      { type: "delete", ids: "r1" },
    ];

    const result = resolveElementsForCheckpoint(parsed);
    expect(result).toEqual([]);
  });

  it("applies deletes to both restored base and newly added elements", () => {
    const base = [
      { type: "rectangle", id: "old", x: 0, y: 0, width: 100, height: 60 },
      { type: "text", id: "old_text", containerId: "old", x: 10, y: 10, width: 30, height: 20 },
      { type: "ellipse", id: "keep", x: 200, y: 0, width: 80, height: 80 },
    ];
    const parsed = [
      { type: "restoreCheckpoint", id: "cp_1" },
      { type: "rectangle", id: "new", x: 20, y: 20, width: 120, height: 80 },
      { type: "text", id: "new_text", containerId: "new", x: 30, y: 30, width: 40, height: 20 },
      { type: "delete", ids: "old,new" },
    ];

    const result = resolveElementsForCheckpoint(parsed, base);
    expect(result).toEqual([{ type: "ellipse", id: "keep", x: 200, y: 0, width: 80, height: 80 }]);
  });
});
