import { describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  exportToBlob: vi.fn(async () => new Blob(["png-bytes"], { type: "image/png" })),
  exportToSvg: vi.fn(async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    return svg;
  }),
  serializeAsJSON: vi.fn(() => "{\"type\":\"excalidraw\"}"),
}));

import { captureContextPng, shareToExcalidraw } from "./share-export";

describe("share-export", () => {
  it("pushes PNG + checkpoint + diff into model context", async () => {
    const app = {
      updateModelContext: vi.fn(async () => { }),
    } as any;

    await captureContextPng(app, [{ id: "r1" }], "cp_123", "User edited diagram");

    expect(app.updateModelContext).toHaveBeenCalledTimes(1);
    const payload = app.updateModelContext.mock.calls[0][0];
    expect(payload.content[0].text).toMatch(/PNG snapshot/i);
    expect(payload.content[1].type).toBe("image");
    expect(payload.content[2].text).toContain("User edited diagram");
    expect(payload.content[2].text).toContain("cp_123");
  });

  it("does not open link when export tool returns an error", async () => {
    const app = {
      callServerTool: vi.fn(async () => ({ isError: true, content: [{ type: "text", text: "failed" }] })),
      openLink: vi.fn(async () => { }),
    } as any;

    await shareToExcalidraw({ elements: [{ id: "r1" }], appState: {}, files: {} }, app);

    expect(app.callServerTool).toHaveBeenCalledTimes(1);
    expect(app.openLink).not.toHaveBeenCalled();
  });
});
