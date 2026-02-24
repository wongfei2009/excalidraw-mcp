export type RawElement = {
  type?: string;
  id?: string;
  ids?: string;
  containerId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};

function collectDeleteIds(elements: RawElement[]): Set<string> {
  const deleteIds = new Set<string>();
  for (const el of elements) {
    if (el.type !== "delete") continue;
    const rawIds = String(el.ids ?? el.id ?? "");
    for (const id of rawIds.split(",")) {
      const trimmed = id.trim();
      if (trimmed) deleteIds.add(trimmed);
    }
  }
  return deleteIds;
}

function filterDeleted(elements: RawElement[], deleteIds: Set<string>): RawElement[] {
  if (deleteIds.size === 0) return elements;
  return elements.filter((el) => {
    const id = String(el.id ?? "");
    const containerId = String(el.containerId ?? "");
    return !deleteIds.has(id) && !deleteIds.has(containerId);
  });
}

export function resolveElementsForCheckpoint(
  parsedElements: RawElement[],
  restoredBaseElements?: RawElement[],
): RawElement[] {
  const deleteIds = collectDeleteIds(parsedElements);
  const newElements = parsedElements.filter(
    (el) => el.type !== "restoreCheckpoint" && el.type !== "delete",
  );
  const merged = restoredBaseElements
    ? [...restoredBaseElements, ...newElements]
    : newElements;
  return filterDeleted(merged, deleteIds);
}
