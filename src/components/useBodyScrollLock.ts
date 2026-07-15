import { useEffect } from "react";

/**
 * Prevents iOS and desktop browsers from moving the dashboard beneath a modal,
 * while restoring the exact scroll position after the final modal closes.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    Object.assign(body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      left: "0",
      right: "0",
      width: "100%",
      overflow: "hidden",
    });

    return () => {
      Object.assign(body.style, previous);
      if (scrollY > 0) window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
