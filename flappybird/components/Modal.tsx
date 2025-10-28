"use client";

import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full sm:w-[92vw] max-w-md max-h-[86vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/15 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <div className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            {title}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
