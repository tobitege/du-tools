export type SessionDropPlacement = "before" | "after";

export interface SessionOrderLike {
  id: string;
  updatedAt: number;
  sortIndex?: number | null;
}

export function sortSessionsByOrder<T extends SessionOrderLike>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aSortIndex = typeof a.sortIndex === "number" ? a.sortIndex : null;
    const bSortIndex = typeof b.sortIndex === "number" ? b.sortIndex : null;
    const aHasSortIndex = aSortIndex !== null;
    const bHasSortIndex = bSortIndex !== null;

    if (aHasSortIndex && bHasSortIndex && aSortIndex !== bSortIndex) {
      return aSortIndex - bSortIndex;
    }

    if (aHasSortIndex !== bHasSortIndex) {
      return aHasSortIndex ? -1 : 1;
    }

    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }

    return a.id.localeCompare(b.id);
  });
}

export function reindexSessions<T extends SessionOrderLike>(entries: T[]): T[] {
  return sortSessionsByOrder(entries).map((entry, index) => ({
    ...entry,
    sortIndex: index,
  }));
}

export function moveSessionInOrder<T extends { id: string }>(
  entries: T[],
  draggedId: string,
  targetId: string,
  placement: SessionDropPlacement
): T[] {
  if (draggedId === targetId) {
    return entries;
  }

  const next = [...entries];
  const draggedIndex = next.findIndex((entry) => entry.id === draggedId);
  const targetIndex = next.findIndex((entry) => entry.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return entries;
  }

  const [draggedEntry] = next.splice(draggedIndex, 1);
  const adjustedTargetIndex = next.findIndex((entry) => entry.id === targetId);
  const insertIndex = placement === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  next.splice(insertIndex, 0, draggedEntry);

  return next;
}
