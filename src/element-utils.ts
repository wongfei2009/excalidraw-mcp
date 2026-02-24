import {
    convertToExcalidrawElements,
    FONT_FAMILY,
} from "@excalidraw/excalidraw";

// ============================================================
// Shared element helpers
// ============================================================

export function parsePartialElements(str: string | undefined): any[] {
    if (!str?.trim().startsWith("[")) return [];
    try { return JSON.parse(str); } catch { /* partial */ }
    const last = str.lastIndexOf("}");
    if (last < 0) return [];
    try { return JSON.parse(str.substring(0, last + 1) + "]"); } catch { /* incomplete */ }
    return [];
}

export function excludeIncompleteLastItem<T>(arr: T[]): T[] {
    if (!arr || arr.length === 0) return [];
    if (arr.length <= 1) return [];
    return arr.slice(0, -1);
}

export interface ViewportRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Convert raw shorthand elements → Excalidraw format (labels → bound text, font fix).
 *  Preserves pseudo-elements like cameraUpdate (not valid Excalidraw types). */
export function convertRawElements(els: any[]): any[] {
    const pseudoTypes = new Set(["cameraUpdate", "delete", "restoreCheckpoint"]);
    const pseudos = els.filter((el: any) => pseudoTypes.has(el.type));
    const real = els.filter((el: any) => !pseudoTypes.has(el.type));
    const withDefaults = real.map((el: any) =>
        el.label ? { ...el, label: { textAlign: "center", verticalAlign: "middle", ...el.label } } : el
    );
    const converted = convertToExcalidrawElements(withDefaults, { regenerateIds: false })
        .map((el: any) => el.type === "text" ? { ...el, fontFamily: (FONT_FAMILY as any).Excalifont ?? 1 } : el);
    return [...converted, ...pseudos];
}

/** Fix SVG viewBox to 4:3 by expanding the smaller dimension and centering. */
export function fixViewBox4x3(svg: SVGSVGElement): void {
    const vb = svg.getAttribute("viewBox")?.split(" ").map(Number);
    if (!vb || vb.length !== 4) return;
    const [vx, vy, vw, vh] = vb;
    const r = vw / vh;
    if (Math.abs(r - 4 / 3) < 0.01) return;
    if (r > 4 / 3) {
        const h2 = Math.round(vw * 3 / 4);
        svg.setAttribute("viewBox", `${vx} ${vy - Math.round((h2 - vh) / 2)} ${vw} ${h2}`);
    } else {
        const w2 = Math.round(vh * 4 / 3);
        svg.setAttribute("viewBox", `${vx - Math.round((w2 - vw) / 2)} ${vy} ${w2} ${vh}`);
    }
}

export function extractViewportAndElements(elements: any[]): {
    viewport: ViewportRect | null;
    drawElements: any[];
    restoreId: string | null;
    deleteIds: Set<string>;
} {
    let viewport: ViewportRect | null = null;
    let restoreId: string | null = null;
    const deleteIds = new Set<string>();
    const drawElements: any[] = [];

    for (const el of elements) {
        if (el.type === "cameraUpdate") {
            viewport = { x: el.x, y: el.y, width: el.width, height: el.height };
        } else if (el.type === "restoreCheckpoint") {
            restoreId = el.id;
        } else if (el.type === "delete") {
            for (const id of String(el.ids ?? el.id).split(",")) deleteIds.add(id.trim());
        } else {
            drawElements.push(el);
        }
    }

    // Hide deleted elements via near-zero opacity instead of removing — preserves SVG
    // group count/order so morphdom matches by position correctly (no cascade re-animations).
    // Using 1 (not 0) because Excalidraw treats opacity:0 as "unset" → defaults to 100.
    const processedDraw = deleteIds.size > 0
        ? drawElements.map((el: any) => (deleteIds.has(el.id) || deleteIds.has(el.containerId)) ? { ...el, opacity: 1 } : el)
        : drawElements;

    return { viewport, drawElements: processedDraw, restoreId, deleteIds };
}

/**
 * Normalize tool input from any tool into { elements: string } for DiagramView.
 * Handles modify_view by prepending a restoreCheckpoint element so the widget
 * works identically to create_view with restoreCheckpoint — no special-casing needed downstream.
 */
export function normalizeToolInput(input: any): { elements: string } {
    const name = (input as any)?.name as string | undefined;
    const args = (input as any)?.arguments ?? input ?? {};

    if (name === "modify_view") {
        const checkpointId: string = args?.checkpointId ?? "";
        const changesStr: string = args?.elements ?? "[]";
        const restoreEl = JSON.stringify({ type: "restoreCheckpoint", id: checkpointId });
        // Splice restoreCheckpoint as the first element of the changes array string.
        // changesStr may be partial JSON during streaming — string manipulation is intentional.
        const trimmed = changesStr.trim();
        let syntheticElements: string;
        if (trimmed === "" || trimmed === "[") {
            syntheticElements = `[${restoreEl}]`;
        } else if (trimmed.startsWith("[")) {
            // Insert after the opening "[", before the rest of the array contents
            const rest = trimmed.slice(1).trim();
            syntheticElements = rest === "" || rest === "]"
                ? `[${restoreEl}]`
                : `[${restoreEl},${trimmed.slice(1)}`;
        } else {
            syntheticElements = `[${restoreEl}]`;
        }
        return { elements: syntheticElements };
    }

    return args;
}
