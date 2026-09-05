"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="border border-border bg-foreground px-3 py-2 text-sm text-background"
      onClick={() => window.print()}
    >
      Печать
    </button>
  );
}
