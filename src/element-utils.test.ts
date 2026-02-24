import { describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  convertToExcalidrawElements: (els: unknown[]) => els,
  FONT_FAMILY: { Excalifont: 1 },
}));

import {
  parsePartialElements,
  excludeIncompleteLastItem,
  extractViewportAndElements,
} from "./element-utils";

describe("element-utils", () => {
  it("parses complete JSON arrays", () => {
    const parsed = parsePartialElements('[{"type":"rectangle","id":"r1"}]');
    expect(parsed).toEqual([{ type: "rectangle", id: "r1" }]);
  });

  it("parses partial arrays by trimming incomplete tail", () => {
    const parsed = parsePartialElements(
      '[{"type":"rectangle","id":"r1"},{"type":"text","id":"t1"',
    );
    expect(parsed).toEqual([{ type: "rectangle", id: "r1" }]);
  });

  it("drops the final item for safe streaming", () => {
    expect(excludeIncompleteLastItem([1, 2, 3])).toEqual([1, 2]);
    expect(excludeIncompleteLastItem([1])).toEqual([]);
  });

  it("extracts viewport + restore checkpoint + delete ids", () => {
    const parsed = [
      { type: "cameraUpdate", x: 10, y: 20, width: 800, height: 600 },
      { type: "restoreCheckpoint", id: "cp_123" },
      { type: "rectangle", id: "r1", x: 0, y: 0, width: 100, height: 60 },
      { type: "text", id: "t1", containerId: "r1", x: 10, y: 10, width: 30, height: 20 },
      { type: "delete", ids: "r1" },
    ];

    const result = extractViewportAndElements(parsed);

    expect(result.viewport).toEqual({ x: 10, y: 20, width: 800, height: 600 });
    expect(result.restoreId).toBe("cp_123");
    expect(result.deleteIds.has("r1")).toBe(true);
    expect(result.drawElements).toEqual([
      { type: "rectangle", id: "r1", x: 0, y: 0, width: 100, height: 60, opacity: 1 },
      { type: "text", id: "t1", containerId: "r1", x: 10, y: 10, width: 30, height: 20, opacity: 1 },
    ]);
  });
});
