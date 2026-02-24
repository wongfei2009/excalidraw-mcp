import type { App } from "@modelcontextprotocol/ext-apps";
import {
    exportToSvg,
    exportToBlob,
    serializeAsJSON,
} from "@excalidraw/excalidraw";
import { useState } from "react";
import { fsLog } from "./logger";

async function blobToBase64(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("Unexpected FileReader result type"));
                return;
            }
            const commaIndex = result.indexOf(",");
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.readAsDataURL(blob);
    });
}

// ============================================================
// Icons
// ============================================================

export const ExpandIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 1.5H12.5V5.5" />
        <path d="M5.5 12.5H1.5V8.5" />
        <path d="M12.5 1.5L8 6" />
        <path d="M1.5 12.5L6 8" />
    </svg>
);

export const ExternalLinkIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8.667V12.667C12 13.035 11.702 13.333 11.333 13.333H3.333C2.965 13.333 2.667 13.035 2.667 12.667V4.667C2.667 4.298 2.965 4 3.333 4H7.333" />
        <path d="M10 2.667H13.333V6" />
        <path d="M6.667 9.333L13.333 2.667" />
    </svg>
);

// ============================================================
// Export utilities
// ============================================================

export async function shareToExcalidraw(data: { elements: readonly any[], appState: any, files: any }, app: App) {
    try {
        if (!data.elements?.length) return;

        // Serialize to Excalidraw JSON
        const json = serializeAsJSON(data.elements, data.appState, data.files, "database");

        // Proxy through server tool (avoids CORS on json.excalidraw.com)
        const result = await app.callServerTool({
            name: "export_to_excalidraw",
            arguments: { json },
        });

        if (result.isError) {
            fsLog(`export failed: ${JSON.stringify(result.content)}`);
            return;
        }

        const url = (result.content[0] as any).text;
        await app.openLink({ url });
    } catch (err) {
        fsLog(`shareToExcalidraw error: ${err}`);
    }
}

export async function copyPngToClipboard(elements: readonly any[], appState: any, files: any) {
    const blob = await exportToBlob({
        elements,
        appState: { viewBackgroundColor: "#ffffff", exportBackground: true, ...appState },
        files: files ?? {},
        mimeType: "image/png",
    });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function copySvgToClipboard(elements: readonly any[], appState: any = {}, files: any = {}) {
    const svg = await exportToSvg({
        elements,
        appState: { viewBackgroundColor: "#ffffff", exportBackground: true, ...appState },
        files: files ?? {},
    });
    await navigator.clipboard.writeText(svg.outerHTML);
}

export async function copyJsonToClipboard(elements: readonly any[], appState: any = {}, files: any = {}) {
    const json = serializeAsJSON(elements, appState, files, "database");
    await navigator.clipboard.writeText(json);
}

/** Capture current elements as a 1024px PNG and push to model context.
 *  Optionally includes a human-readable diff of user manual edits. */
export async function captureContextPng(app: App, elements: readonly any[], checkpointId?: string | null, diffText?: string) {
    if (!elements.length) return;
    const blob = await exportToBlob({
        elements,
        appState: { viewBackgroundColor: "#ffffff", exportBackground: true } as any,
        files: {},
        mimeType: "image/png",
        maxWidthOrHeight: 1024,
    });
    const base64 = await blobToBase64(blob);
    const content: any[] = [
        { type: "text", text: "Below is a PNG snapshot of the current diagram as the user sees it. Review it to understand the current layout before making changes." },
        { type: "image", data: base64, mimeType: "image/png" },
    ];
    if (checkpointId) {
        let msg: string;
        if (diffText) {
            msg =
                `IMPORTANT — The user manually edited this diagram.\n` +
                `${diffText}\n\n` +
                `These edits are already saved in checkpoint "${checkpointId}". When you call modify_view, ` +
                `the checkpoint is restored WITH all user edits applied. ` +
                `Do NOT recreate, revert, or overwrite any user-modified element — only add net-new elements or targeted deletes. ` +
                `Do NOT call create_view (it discards all user edits).`;
        } else {
            msg =
                `Current diagram checkpoint: "${checkpointId}". ` +
                `To modify this diagram (add elements, remove elements, change layout, update colors, improve anything) ` +
                `— call modify_view with checkpointId="${checkpointId}". ` +
                `Do NOT call create_view, which would discard this diagram and start over.`;
        }
        content.push({ type: "text", text: msg });
    } else if (diffText) {
        content.push({ type: "text", text: `IMPORTANT — The user manually edited this diagram:\n${diffText}` });
    }
    await app.updateModelContext({ content });
}

// ============================================================
// ShareButton component
// ============================================================

export function ShareButton({
    onExport,
    onCopyJson,
    onCopySvg,
    onCopyPng,
}: {
    onExport: () => Promise<void>;
    onCopyJson: () => Promise<void>;
    onCopySvg: () => Promise<void>;
    onCopyPng: () => Promise<void>;
}) {
    const [state, setState] = useState<"idle" | "confirm" | "uploading">("idle");
    const [copyJsonState, setCopyJsonState] = useState<"idle" | "copied">("idle");
    const [copySvgState, setCopySvgState] = useState<"idle" | "copied">("idle");
    const [copyPngState, setCopyPngState] = useState<"idle" | "copied">("idle");

    const handleExport = async () => {
        setState("uploading");
        try {
            await onExport();
        } finally {
            setState("idle");
        }
    };

    const handleCopyJson = async () => {
        await onCopyJson();
        setCopyJsonState("copied");
        setTimeout(() => setCopyJsonState("idle"), 2000);
    };

    const handleCopySvg = async () => {
        await onCopySvg();
        setCopySvgState("copied");
        setTimeout(() => setCopySvgState("idle"), 2000);
    };

    const handleCopyPng = async () => {
        await onCopyPng();
        setCopyPngState("copied");
        setTimeout(() => setCopyPngState("idle"), 2000);
    };

    return (
        <>
            <button
                className=" app-button"
                style={{ display: "flex", alignItems: "center", gap: 5, width: "auto", padding: "0 10px", marginRight: -8 }}
                title="Save or Export Diagram"
                disabled={state === "uploading"}
                onClick={() => setState("confirm")}
            >
                <ExternalLinkIcon />
                <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>{state === "uploading" ? "Saving…" : "Save / Export"}</span>
            </button>

            {state === "confirm" && (
                <div className="excalidraw export-modal-overlay" onClick={() => setState("idle")}>
                    <div className="Island export-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="export-modal-title">Save or Export Diagram</h3>
                        <p className="export-modal-text" style={{ marginBottom: 15 }}>
                            Choose how you would like to save your work:
                        </p>
                        <div className="export-modal-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                            <button className="standalone export-modal-confirm" onClick={handleExport}>
                                Export to Excalidraw.com
                            </button>
                            <div style={{ height: 1, background: "var(--border-color)", margin: "4px 0" }} />
                            <button className="standalone" onClick={handleCopyJson}>
                                {copyJsonState === "idle" ? "Copy JSON to Clipboard (.excalidraw)" : "✓ JSON Copied!"}
                            </button>
                            <button className="standalone" onClick={handleCopySvg}>
                                {copySvgState === "idle" ? "Copy SVG to Clipboard" : "✓ SVG Copied!"}
                            </button>
                            <button className="standalone" onClick={handleCopyPng}>
                                {copyPngState === "idle" ? "Copy PNG to Clipboard" : "✓ PNG Copied!"}
                            </button>
                            <button
                                className="standalone"
                                style={{ marginTop: 8, opacity: 0.6 }}
                                onClick={() => setState("idle")}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
