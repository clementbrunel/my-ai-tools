import { useEffect } from "react";

/** Drag & drop of files onto the window: calls `onFiles` with the filesystem paths. */
export function useFileDrop(onFiles: (paths: string[]) => void): void {
  useEffect(() => {
    const onDragOver = (e: DragEvent): void => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent): void => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      // getPathForFile returns "" for items that are not real files (e.g. dragged text).
      const paths = Array.from(e.dataTransfer.files)
        .map((file) => window.cblLog.getPathForFile(file))
        .filter((p) => p !== "");
      if (paths.length > 0) onFiles(paths);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onFiles]);
}
