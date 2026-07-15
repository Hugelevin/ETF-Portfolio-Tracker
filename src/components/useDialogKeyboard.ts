import { useEffect, useRef } from "react";

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

export function useDialogKeyboard(onClose: () => void, initialSelector?: string) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const target = initialSelector
        ? dialogRef.current?.querySelector<HTMLElement>(initialSelector)
        : dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
    return () => { cancelAnimationFrame(frame); previous?.focus({ preventScroll: true }); };
  }, [initialSelector]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((item) => item.offsetParent !== null || item === document.activeElement);
    if (!controls.length) return;
    const first = controls[0]!;
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return { dialogRef, onKeyDown };
}
