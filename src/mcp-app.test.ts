import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@modelcontextprotocol/ext-apps/react", () => ({
  useApp: vi.fn(),
}));

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: () => null,
  restore: ({ elements }: any) => ({ elements }),
  CaptureUpdateAction: { NEVER: 0 },
  MainMenu: Object.assign(({ children }: any) => children, { Item: ({ children }: any) => children }),
}));

vi.mock("./svg-renderer", () => ({
  DiagramView: () => null,
}));

vi.mock("./share-export", () => ({
  ShareButton: () => null,
  shareToExcalidraw: vi.fn(),
  copyJsonToClipboard: vi.fn(),
  copySvgToClipboard: vi.fn(),
  copyPngToClipboard: vi.fn(),
  captureContextPng: vi.fn(),
  ExpandIcon: () => null,
}));

vi.mock("./global.css", () => ({}));

import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { ExcalidrawApp } from "./mcp-app";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("ExcalidrawApp", () => {
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

  it("renders loading state when app is not ready", () => {
    vi.mocked(useApp).mockReturnValue({ app: null, error: null } as any);

    container = document.createElement("div");
    document.body.appendChild(container);
    const localRoot = createRoot(container);
    root = localRoot;

    act(() => {
      localRoot.render(createElement(ExcalidrawApp));
    });

    expect(container.textContent).toContain("Connecting");
  });

  it("renders error state when useApp returns an error", () => {
    vi.mocked(useApp).mockReturnValue({ app: null, error: new Error("boom") } as any);

    container = document.createElement("div");
    document.body.appendChild(container);
    const localRoot = createRoot(container);
    root = localRoot;

    act(() => {
      localRoot.render(createElement(ExcalidrawApp));
    });

    expect(container.textContent).toContain("ERROR: boom");
  });
});
