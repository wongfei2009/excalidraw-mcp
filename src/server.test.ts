import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@modelcontextprotocol/ext-apps/server", () => ({
  RESOURCE_MIME_TYPE: "text/html",
  registerAppResource: vi.fn(),
  registerAppTool: (server: any, name: string, schema: unknown, handler: unknown) => {
    server.registerTool(name, schema, handler as any);
  },
}));

import { registerTools } from "./server";

type ToolHandler = (args: Record<string, string>) => Promise<any>;

class FakeServer {
  public tools = new Map<string, ToolHandler>();
  public server = {
    elicitInput: vi.fn(),
  };

  registerTool(name: string, _schema: unknown, handler: ToolHandler) {
    this.tools.set(name, handler);
  }
}

const fakeStore = {
  save: vi.fn(async () => {}),
  load: vi.fn(async () => null),
};

function getHandler(server: FakeServer, name: string): ToolHandler {
  const handler = server.tools.get(name);
  if (!handler) throw new Error(`Missing handler: ${name}`);
  return handler;
}

describe("server byte limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects UTF-8 oversized create_view payloads", async () => {
    const server = new FakeServer();
    registerTools(server as any, "/tmp", fakeStore as any);
    const createView = getHandler(server, "create_view");

    const text = "😀".repeat(1_400_000);
    const elements = JSON.stringify([
      { type: "text", id: "t1", x: 0, y: 0, width: 1, height: 1, text },
    ]);

    const result = await createView({ elements });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/exceeds/i);
  });

  it("rejects UTF-8 oversized export_to_excalidraw payloads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const server = new FakeServer();
    registerTools(server as any, "/tmp", fakeStore as any);
    const exportTool = getHandler(server, "export_to_excalidraw");

    const json = "😀".repeat(1_400_000);
    const result = await exportTool({ json });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/exceeds/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects UTF-8 oversized save_checkpoint payloads", async () => {
    const server = new FakeServer();
    registerTools(server as any, "/tmp", fakeStore as any);
    const saveCheckpoint = getHandler(server, "save_checkpoint");

    const data = "😀".repeat(1_400_000);
    const result = await saveCheckpoint({ id: "cp_ok", data });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/exceeds/i);
  });
});
