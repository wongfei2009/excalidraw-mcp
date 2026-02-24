import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { App } from "@modelcontextprotocol/ext-apps";
import {
  Excalidraw,
  restore,
  CaptureUpdateAction,
  MainMenu,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { onEditorChange, setStorageKey, loadPersistedElements, getLatestEditedElements, setCheckpointId, resetEditSession } from "./edit-context";
import { createDebouncedCallback } from "./debounce";
import { fsLog, setLogFn } from "./logger";
import { normalizeToolInput } from "./element-utils";
import type { ViewportRect } from "./element-utils";
import { DiagramView } from "./svg-renderer";
import {
  ShareButton,
  shareToExcalidraw,
  copyJsonToClipboard,
  copySvgToClipboard,
  copyPngToClipboard,
  captureContextPng,
  ExpandIcon
} from "./share-export";
import "./global.css";

const MODEL_CONTEXT_DEBOUNCE_MS = 1500;

const excalidrawLogo = <svg
  focusable="false"
  role="img"
  viewBox="0 0 40 40"
  fill="none"
>
  <g fill="currentColor">
    <path
      d="M39.9 32.889a.326.326 0 0 0-.279-.056c-2.094-3.083-4.774-6-7.343-8.833l-.419-.472a.212.212 0 0 0-.056-.139.586.586 0 0 0-.167-.111l-.084-.083-.056-.056c-.084-.167-.28-.278-.475-.167-.782.39-1.507.973-2.206 1.528-.92.722-1.842 1.445-2.708 2.25a8.405 8.405 0 0 0-.977 1.028c-.14.194-.028.361.14.444-.615.611-1.23 1.223-1.843 1.861a.315.315 0 0 0-.084.223c0 .083.056.166.111.194l1.09.833v.028c1.535 1.528 4.244 3.611 7.12 5.861.418.334.865.667 1.284 1 .195.223.39.473.558.695.084.11.28.139.391.055.056.056.14.111.196.167a.398.398 0 0 0 .167.056.255.255 0 0 0 .224-.111.394.394 0 0 0 .055-.167c.029 0 .028.028.056.028a.318.318 0 0 0 .224-.084l5.082-5.528a.309.309 0 0 0 0-.444Zm-14.63-1.917a.485.485 0 0 0 .111.14c.586.5 1.2 1 1.843 1.555l-2.569-1.945-.251-.166c-.056-.028-.112-.084-.168-.111l-.195-.167.056-.056.055-.055.112-.111c.866-.861 2.346-2.306 3.1-3.028-.81.805-2.43 3.167-2.095 3.944Zm8.767 6.89-2.122-1.612a44.713 44.713 0 0 0-2.625-2.5c1.145.861 2.122 1.611 2.262 1.75 1.117.972 1.06.806 1.815 1.445l.921.666a1.06 1.06 0 0 1-.251.25Zm.558.416-.056-.028c.084-.055.168-.111.252-.194l-.196.222ZM1.089 5.75c.055.361.14.722.195 1.056.335 1.833.67 3.5 1.284 4.75l.252.944c.084.361.223.806.363.917 1.424 1.25 3.602 3.11 5.947 4.889a.295.295 0 0 0 .363 0s0 .027.028.027a.254.254 0 0 0 .196.084.318.318 0 0 0 .223-.084c2.988-3.305 5.221-6.027 6.813-8.305.112-.111.14-.278.14-.417.111-.111.195-.25.307-.333.111-.111.111-.306 0-.39l-.028-.027c0-.055-.028-.139-.084-.167-.698-.666-1.2-1.138-1.731-1.638-.922-.862-1.871-1.75-3.881-3.75l-.028-.028c-.028-.028-.056-.056-.112-.056-.558-.194-1.703-.389-3.127-.639C6.087 2.223 3.21 1.723.614.944c0 0-.168 0-.196.028l-.083.084c-.028.027-.056.055-.224.11h.056-.056c.028.167.028.278.084.473 0 .055.112.5.112.555l.782 3.556Zm15.496 3.278-.335-.334c.084.112.196.195.335.334Zm-3.546 4.666-.056.056c0-.028.028-.056.056-.056Zm-2.038-10c.168.167.866.834 1.033.973-.726-.334-2.54-1.167-3.379-1.445.838.167 1.983.334 2.346.472ZM1.424 2.306c.419.722.754 3.222 1.089 5.666-.196-.778-.335-1.555-.503-2.278-.251-1.277-.503-2.416-.838-3.416.056 0 .14 0 .252.028Zm-.168-.584c-.112 0-.223-.028-.307-.028 0-.027 0-.055-.028-.055.14 0 .223.028.335.083Zm-1.089.222c0-.027 0-.027 0 0ZM39.453 1.333c.028-.11-.558-.61-.363-.639.42-.027.42-.666 0-.666-.558.028-1.144.166-1.675.25-.977.194-1.982.389-2.96.61-2.205.473-4.383.973-6.561 1.557-.67.194-1.424.333-2.066.666-.224.111-.196.333-.084.472-.056.028-.084.028-.14.056-.195.028-.363.056-.558.083-.168.028-.252.167-.224.334 0 .027.028.083.028.11-1.173 1.556-2.485 3.195-3.909 4.945-1.396 1.611-2.876 3.306-4.356 5.056-4.719 5.5-10.052 11.75-15.943 17.25a.268.268 0 0 0 0 .389c.028.027.056.055.084.055-.084.084-.168.14-.252.222-.056.056-.084.111-.084.167a.605.605 0 0 0-.111.139c-.112.111-.112.305.028.389.111.11.307.11.39-.028.029-.028.029-.056.056-.056a.44.44 0 0 1 .615 0c.335.362.67.723.977 1.028l-.698-.583c-.112-.111-.307-.083-.39.028-.113.11-.085.305.027.389l7.427 6.194c.056.056.112.056.196.056s.14-.028.195-.084l.168-.166c.028.027.083.027.111.027.084 0 .14-.027.196-.083 10.052-10.055 18.15-17.639 27.42-24.417.083-.055.111-.166.111-.25.112 0 .196-.083.251-.194 1.704-5.194 2.039-9.806 2.15-12.083v-.028c0-.028.028-.056.028-.083.028-.056.028-.084.028-.084a1.626 1.626 0 0 0-.111-1.028ZM21.472 9.5c.446-.5.893-1.028 1.34-1.5-2.876 3.778-7.65 9.583-14.408 16.5 4.607-5.083 9.242-10.333 13.068-15ZM5.193 35.778h.084-.084Zm3.462 3.194c-.027-.028-.027-.028 0-.028v.028Zm4.16-3.583c.224-.25.448-.472.699-.722 0 0 0 .027.028.027-.252.223-.475.445-.726.695Zm1.146-1.111c.14-.14.279-.334.446-.5l.028-.028c1.648-1.694 3.351-3.389 5.082-5.111l.028-.028c.419-.333.921-.694 1.368-1.028a379.003 379.003 0 0 0-6.952 6.695ZM24.794 6.472c-.921 1.195-1.954 2.778-2.82 4.028-2.736 3.944-11.532 13.583-11.727 13.75a1976.983 1976.983 0 0 1-8.042 7.639l-.167.167c-.14-.167-.14-.417.028-.556C14.49 19.861 22.03 10.167 25.074 5.917c-.084.194-.14.36-.28.555Zm4.83 5.695c-1.116-.64-1.646-1.64-1.34-2.611l.084-.334c.028-.083.084-.194.14-.277.307-.5.754-.917 1.257-1.167.027 0 .055 0 .083-.028-.028-.056-.028-.139-.028-.222.028-.167.14-.278.335-.278.335 0 1.369.306 1.76.639.111.083.223.194.335.305.14.167.363.445.474.667.056.028.112.306.196.445.056.222.111.472.084.694-.028.028 0 .194-.028.194a2.668 2.668 0 0 1-.363 1.028c-.028.028-.028.056-.056.084l-.028.027c-.14.223-.335.417-.53.556-.643.444-1.369.583-2.095.389 0 0-.195-.084-.28-.111Zm8.154-.834a39.098 39.098 0 0 1-.893 3.167c0 .028-.028.083 0 .111-.056 0-.084.028-.14.056-2.206 1.61-4.356 3.305-6.506 5.028 1.843-1.64 3.686-3.306 5.613-4.945.558-.5.949-1.139 1.06-1.861l.28-1.667v-.055c.14-.334.67-.195.586.166Z"
      fill="currentColor"
    />
  </g>
</svg>

const githubIcon = <svg focusable="false" role="img" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 15.833c-3.583 1.167-3.583-2.083-5-2.5m10 4.167v-2.917c0-.833.083-1.166-.417-1.666 2.334-.25 4.584-1.167 4.584-5a3.833 3.833 0 0 0-1.084-2.667 3.5 3.5 0 0 0-.083-2.667s-.917-.25-2.917 1.084a10.25 10.25 0 0 0-5.166 0C5.417 2.333 4.5 2.583 4.5 2.583a3.5 3.5 0 0 0-.083 2.667 3.833 3.833 0 0 0-1.084 2.667c0 3.833 2.25 4.75 4.584 5-.5.5-.5 1-.417 1.666V17.5" strokeWidth="1.25"></path></svg>

const twitterIcon = <svg focusable="false" role="img" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g strokeWidth="1.25"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></g></svg>

const discordIcon = <svg focusable="false" role="img" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><g strokeWidth="1.25"><path d="M7.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM12.5 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM6.25 6.25c2.917-.833 4.583-.833 7.5 0M5.833 13.75c2.917.833 5.417.833 8.334 0"></path><path d="M12.917 14.167c0 .833 1.25 2.5 1.666 2.5 1.25 0 2.361-1.39 2.917-2.5.556-1.39.417-4.861-1.25-9.584-1.214-.846-2.5-1.116-3.75-1.25l-.833 2.084M7.083 14.167c0 .833-1.13 2.5-1.526 2.5-1.191 0-2.249-1.39-2.778-2.5-.529-1.39-.397-4.861 1.19-9.584 1.157-.846 2.318-1.116 3.531-1.25l.833 2.084"></path></g></svg>


export function ExcalidrawAppCore({ app }: { app: App }) {
  const [toolInput, setToolInput] = useState<{ elements?: string | unknown[] } | null>(null);
  const [inputIsFinal, setInputIsFinal] = useState(false);
  const [displayMode, setDisplayMode] = useState<"inline" | "fullscreen">("inline");
  const [elements, setElements] = useState<ExcalidrawElement[]>([]);
  const [userEdits, setUserEdits] = useState<ExcalidrawElement[] | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [editorSettled, setEditorSettled] = useState(false);
  const appRef = useRef<App | null>(null);
  const svgViewportRef = useRef<ViewportRect | null>(null);
  const elementsRef = useRef<ExcalidrawElement[]>([]);
  const checkpointIdRef = useRef<string | null>(null);
  const captureDebounceRef = useRef(
    createDebouncedCallback(
      (latestElements: ExcalidrawElement[], checkpointId: string | null) => {
        if (!appRef.current || latestElements.length === 0) return;
        captureContextPng(appRef.current, latestElements, checkpointId).catch(() => { });
      },
      MODEL_CONTEXT_DEBOUNCE_MS,
    ),
  );

  // Stable callbacks for DiagramView (avoid re-creating on every render)
  const handleElements = useCallback((els: ExcalidrawElement[]) => {
    elementsRef.current = els;
    setElements(els);
  }, []);

  const handleViewport = useCallback((vp: ViewportRect) => {
    svgViewportRef.current = vp;
  }, []);

  const handleLoadCheckpoint = useCallback(async (id: string): Promise<{ elements: ExcalidrawElement[] } | null> => {
    if (!appRef.current) return null;
    try {
      const result = await appRef.current.callServerTool({ name: "read_checkpoint", arguments: { id } });
      const text = (result.content[0] as { text?: string } | undefined)?.text;
      if (!text) return null;
      return JSON.parse(text) as { elements: ExcalidrawElement[] };
    } catch { return null; }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!appRef.current) return;
    const newMode = displayMode === "fullscreen" ? "inline" : "fullscreen";
    fsLog(`toggle: ${displayMode}→${newMode}`);
    // Sync edited elements before leaving fullscreen
    if (newMode === "inline") {
      const edited = getLatestEditedElements();
      if (edited) {
        setElements(edited);
        setUserEdits(edited);
      }
    }
    try {
      const result = await appRef.current.requestDisplayMode({ mode: newMode });
      fsLog(`requestDisplayMode result: ${result.mode}`);
      setDisplayMode(result.mode as "inline" | "fullscreen");
    } catch (err) {
      fsLog(`requestDisplayMode FAILED: ${err}`);
    }
  }, [displayMode, elements.length, inputIsFinal]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && displayMode === "fullscreen") toggleFullscreen();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [displayMode, toggleFullscreen]);

  // Capture PNG and push to model context (debounced to avoid expensive streaming churn)
  useEffect(() => {
    if (elements.length === 0) {
      captureDebounceRef.current.cancel();
      return;
    }
    captureDebounceRef.current.trigger(elements, checkpointIdRef.current);
  }, [elements]);

  useEffect(() => {
    return () => captureDebounceRef.current.cancel();
  }, []);

  // Preload ALL Excalidraw fonts on first mount (inline mode) so they're
  // cached before fullscreen. Without this, Excalidraw's component init
  // downloads Assistant fonts, triggering a font recalc that corrupts
  // text dimensions measured with not-yet-loaded Excalifont.
  useEffect(() => {
    Promise.all([
      document.fonts.load('20px Excalifont'),
      document.fonts.load('400 16px Assistant'),
      document.fonts.load('500 16px Assistant'),
      document.fonts.load('700 16px Assistant'),
    ]).catch(() => { });
  }, []);

  // Set explicit height on html/body in fullscreen (position:fixed doesn't give body height in iframes)
  useEffect(() => {
    if (displayMode === "fullscreen" && containerHeight) {
      const h = `${containerHeight}px`;
      document.documentElement.style.height = h;
      document.body.style.height = h;
    } else {
      document.documentElement.style.height = "";
      document.body.style.height = "";
    }
  }, [displayMode, containerHeight]);

  // Mount editor when entering fullscreen
  useEffect(() => {
    if (displayMode !== "fullscreen") {
      setEditorReady(false);
      setExcalidrawApi(null);
      setEditorSettled(false);
      return;
    }
    (async () => {
      await document.fonts.ready;
      setTimeout(() => setEditorReady(true), 200);
    })();
  }, [displayMode]);

  // After editor mounts: refresh text dimensions, then reveal
  const mountEditor = displayMode === "fullscreen" && inputIsFinal && elements.length > 0 && editorReady;
  useEffect(() => {
    if (!mountEditor || !excalidrawApi) return;
    if (editorSettled) return; // already revealed, don't redo
    const api = excalidrawApi;

    const settle = async () => {
      try { await document.fonts.load('20px Excalifont'); } catch { }
      await document.fonts.ready;

      const sceneElements = api.getSceneElements();
      if (sceneElements?.length) {
        const { elements: fixed } = restore(
          { elements: sceneElements },
          null, null,
          { refreshDimensions: true }
        );
        api.updateScene({
          elements: fixed,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
      requestAnimationFrame(() => setEditorSettled(true));
    };

    const timer = setTimeout(settle, 200);
    return () => clearTimeout(timer);
  }, [mountEditor, excalidrawApi, editorSettled]);

  // Keep elementsRef in sync for ontoolresult handler (which captures closure once)
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  // Set up MCP event handlers when app is provided
  useEffect(() => {
    appRef.current = app;
    setLogFn((msg) => { try { app.sendLog({ level: "info", logger: "FS", data: msg }); } catch { } });

    // Capture initial container dimensions
    const initDims = app.getHostContext()?.containerDimensions as any;
    if (initDims?.height) setContainerHeight(initDims.height);

    app.onhostcontextchanged = (ctx: any) => {
      if (ctx.containerDimensions?.height) {
        setContainerHeight(ctx.containerDimensions.height);
      }
      if (ctx.displayMode) {
        fsLog(`hostContextChanged: displayMode=${ctx.displayMode}`);
        // Sync edited elements when host exits fullscreen
        if (ctx.displayMode === "inline") {
          const edited = getLatestEditedElements();
          if (edited) {
            setElements(edited);
            setUserEdits(edited);
          }
        }
        setDisplayMode(ctx.displayMode as "inline" | "fullscreen");
      }
    };

    app.ontoolinputpartial = async (input) => {
      setInputIsFinal(false);
      setToolInput(normalizeToolInput(input));
    };

    app.ontoolinput = async (input) => {
      setInputIsFinal(true);
      setToolInput(normalizeToolInput(input));
    };

    app.ontoolresult = (result: any) => {
      const cpId = (result.structuredContent as { checkpointId?: string })?.checkpointId;
      if (cpId) {
        checkpointIdRef.current = cpId;
        setCheckpointId(cpId);
        resetEditSession();
        setUserEdits(null);
        // Use checkpointId as localStorage key for persisting user edits
        setStorageKey(cpId);
        // Check for persisted edits from a previous fullscreen session
        const persisted = loadPersistedElements();
        if (persisted && persisted.length > 0) {
          elementsRef.current = persisted;
          setElements(persisted);
          setUserEdits(persisted);
        }
      }
    };

    app.onteardown = async () => ({});
    app.onerror = (err) => {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      try {
        app.sendLog({ level: "error", logger: "Excalidraw", data: message });
      } catch {
        fsLog(`app.onerror: ${message}`);
      }
    };
  }, [app]);

  return (
    <main className={`main${displayMode === "fullscreen" ? " fullscreen" : ""}`} style={displayMode === "fullscreen" && containerHeight ? { height: containerHeight } : undefined}>
      {displayMode === "inline" && (
        <div className="toolbar">
          <ShareButton
            onExport={async () => {
              await shareToExcalidraw({ elements, appState: {}, files: {} }, app);
            }}
            onCopyJson={async () => {
              try {
                await copyJsonToClipboard(elements, {}, {});
              } catch (err) {
                fsLog(`Copy JSON failed: ${err}`);
              }
            }}
            onCopySvg={async () => {
              try {
                await copySvgToClipboard(elements, {}, {});
              } catch (err) {
                fsLog(`Copy SVG failed: ${err}`);
              }
            }}
            onCopyPng={async () => {
              try {
                await copyPngToClipboard(elements, {}, {});
              } catch (err) {
                fsLog(`Copy PNG failed: ${err}`);
              }
            }}
          />

          <button
            className="app-button"
            onClick={toggleFullscreen}
            title="Enter fullscreen"
          >
            <span>Edit</span>
            <ExpandIcon />
          </button>
        </div>
      )}
      {/* Editor: mount hidden when ready, reveal after viewport is set */}
      {mountEditor && (
        <div style={{
          width: "100%",
          height: "100%",
          visibility: editorSettled ? "visible" : "hidden",
          position: editorSettled ? undefined : "absolute",
          inset: editorSettled ? undefined : 0,
        }}>
          <Excalidraw
            excalidrawAPI={(api) => { setExcalidrawApi(api); fsLog(`excalidrawAPI set`); }}
            initialData={{ elements: elements as any, scrollToContent: true }}
            theme="light"
            onChange={(els) => { if (appRef.current) onEditorChange(appRef.current, els); }}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                export: false,
                saveAsImage: false,
                loadScene: false,
              },
            }}
            renderTopRightUI={() => (
              <ShareButton
                onExport={async () => {
                  if (excalidrawApi) {
                    const elements = excalidrawApi.getSceneElements();
                    const appState = excalidrawApi.getAppState();
                    const files = excalidrawApi.getFiles();
                    await shareToExcalidraw({ elements, appState, files }, app);
                  }
                }}
                onCopyJson={async () => {
                  if (!excalidrawApi) return;
                  try {
                    const elements = excalidrawApi.getSceneElements();
                    const appState = excalidrawApi.getAppState();
                    const files = excalidrawApi.getFiles();
                    await copyJsonToClipboard(elements, appState, files);
                  } catch (err) {
                    fsLog(`Copy failed: ${err}`);
                  }
                }}
                onCopySvg={async () => {
                  if (!excalidrawApi) return;
                  try {
                    const elements = excalidrawApi.getSceneElements();
                    const appState = excalidrawApi.getAppState();
                    const files = excalidrawApi.getFiles();
                    await copySvgToClipboard(elements, appState, files);
                  } catch (err) {
                    fsLog(`Copy SVG failed: ${err}`);
                  }
                }}
                onCopyPng={async () => {
                  if (!excalidrawApi) return;
                  try {
                    const elements = excalidrawApi.getSceneElements();
                    const appState = excalidrawApi.getAppState();
                    const files = excalidrawApi.getFiles();
                    await copyPngToClipboard(elements, appState, files);
                  } catch (err) {
                    fsLog(`Copy PNG failed: ${err}`);
                  }
                }}
              />
            )}
          >
            <MainMenu>
              <MainMenu.Item
                onSelect={() => {
                  app.openLink({
                    url: "https://plus.excalidraw.com?utm_source=mcp_app_menu"
                  })
                }}
                style={{ minWidth: 200 }}
              >
                {excalidrawLogo} Excalidraw
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={() => {
                  app.openLink({
                    url: "https://github.com/excalidraw/excalidraw"
                  })
                }}
                style={{ minWidth: 200 }}
              >
                {githubIcon} GitHub
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={() => {
                  app.openLink({
                    url: "https://x.com/excalidraw"
                  })
                }}
                style={{ minWidth: 200 }}
              >
                {twitterIcon} Follow us
              </MainMenu.Item>
              <MainMenu.Item
                onSelect={() => {
                  app.openLink({
                    url: "https://discord.gg/UexuTaE"
                  })
                }}
                style={{ minWidth: 200 }}
              >
                {discordIcon} Discord chat
              </MainMenu.Item>
            </MainMenu>
          </Excalidraw>
        </div>
      )}
      {/* SVG: stays visible until editor is fully settled */}
      {!editorSettled && (
        <div>
          <DiagramView
            toolInput={toolInput}
            isFinal={inputIsFinal}
            displayMode={displayMode}
            onElements={handleElements}
            editedElements={userEdits ?? undefined}
            onViewport={handleViewport}
            loadCheckpoint={handleLoadCheckpoint}
          />
        </div>
      )}
    </main>
  );
}

export function ExcalidrawApp() {
  const { app, error } = useApp({
    appInfo: { name: "Excalidraw", version: "1.0.0" },
    capabilities: {},
  });

  if (error) return <div className="error">ERROR: {error.message}</div>;
  if (!app) return <div className="loading">Connecting...</div>;
  return <ExcalidrawAppCore app={app} />;
}
