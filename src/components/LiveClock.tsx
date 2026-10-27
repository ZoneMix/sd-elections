"use client";

import { useEffect, useState } from "react";
import { agoLabel } from "@/lib/format";

/** Ticking "12s ago" label. `at` is null until the first load, so the output
 * is "Loading" on both server and client first render (no hydration drift). */
export function LiveClock({ at }: { at: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="num">{at ? agoLabel(at, now) : "Loading"}</span>;
}
