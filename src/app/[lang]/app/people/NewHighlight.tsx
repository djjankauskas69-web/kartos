"use client";

import { useEffect } from "react";

/** Brings a just-added person into view in the list. */
export function NewHighlight({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(`person-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [id]);
  return null;
}
