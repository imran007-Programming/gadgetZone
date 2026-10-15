"use client";

import { useEffect, useMemo } from "react";

// Revokes are delayed so a Strict Mode re-mount (cleanup → effect again) can
// cancel them instead of killing a preview that is still on screen.
const pendingRevokes = new Map<string, ReturnType<typeof setTimeout>>();
const REVOKE_DELAY_MS = 1000;

/** Object URLs for locally picked files, revoked once the selection changes or the component unmounts. */
export function useObjectUrls(files: File[]): string[] {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    for (const url of urls) {
      clearTimeout(pendingRevokes.get(url));
      pendingRevokes.delete(url);
    }
    return () => {
      for (const url of urls) {
        pendingRevokes.set(
          url,
          setTimeout(() => {
            URL.revokeObjectURL(url);
            pendingRevokes.delete(url);
          }, REVOKE_DELAY_MS),
        );
      }
    };
  }, [urls]);

  return urls;
}

/** Preview URL for a single picked file, or null when nothing is picked. */
export function useObjectUrl(file: File | null): string | null {
  const files = useMemo(() => (file ? [file] : []), [file]);
  return useObjectUrls(files)[0] ?? null;
}
