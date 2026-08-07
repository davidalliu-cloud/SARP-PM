"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const ModalCloseContext = createContext<() => void>(() => {});

/** Lets form components rendered inside a <Modal> close it after a successful save. */
export function useModalClose() {
  return useContext(ModalCloseContext);
}

export function Modal({
  triggerLabel,
  triggerClassName = "btn btn-primary",
  title,
  eyebrow = "SARP workflow",
  description,
  size = "lg",
  children,
}: {
  triggerLabel: ReactNode;
  triggerClassName?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const maxWidth = size === "xl" ? "max-w-5xl" : size === "md" ? "max-w-lg" : "max-w-3xl";

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-6"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`surface-card my-6 w-full ${maxWidth} shadow-[0_24px_48px_rgba(91,25,63,0.18)]`}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">
                      {eyebrow}
                    </div>
                    <h2 className="mt-1 text-xl font-bold tracking-[-0.01em] text-ink">{title}</h2>
                    {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={close}
                    className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-sm font-semibold text-ink transition hover:border-lab-burgundy hover:bg-lab-burgundy hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-6 py-5">
                  <ModalCloseContext.Provider value={close}>{children}</ModalCloseContext.Provider>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
