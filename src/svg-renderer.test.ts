import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
  exportToSvg: vi.fn(async () => document.createElementNS("http://www.w3.org/2000/svg", "svg")),
}));

vi.mock("morphdom", () => ({
  default: vi.fn(),
}));

vi.mock("./pencil-audio", () => ({
  initPencilAudio: vi.fn(),
  playStroke: vi.fn(),
}));

vi.mock("./edit-context", () => ({
  captureInitialElements: vi.fn(),
}));

vi.mock("./element-utils", async () => {
  const actual = await vi.importActual<typeof import("./element-utils")>("./element-utils");
  return {
    ...actual,
    convertRawElements: (els: unknown[]) => els,
  };
});

import { DiagramView } from "./svg-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

describe("DiagramView", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    if (container?.parentNode) container.parentNode.removeChild(container);
  });

  it("renders the container in idle state", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const localRoot = createRoot(container);
    root = localRoot;

    act(() => {
      localRoot.render(
        createElement(DiagramView, {
          toolInput: null,
          isFinal: false,
          displayMode: "inline",
        }),
      );
    });

    expect(container.querySelector(".excalidraw-container")).not.toBeNull();
  });
});
