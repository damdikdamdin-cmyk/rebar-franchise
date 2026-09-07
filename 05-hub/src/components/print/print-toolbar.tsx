"use client";

import { useEffect } from "react";

export function PrintToolbar({ title, back, editHref, auto, count }: { title: string; back: string; editHref: string; auto: boolean; count: number }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <div
      className="no-print"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "10px 16px",
        background: "#0a0b0d",
        color: "#f6f7f8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
      }}
    >
      <a href={back} style={{ color: "#9aa0a6", textDecoration: "none" }}>
        ← назад
      </a>
      <strong style={{ fontWeight: 600 }}>{title}</strong>
      <span style={{ color: "#9aa0a6" }}>{count > 1 ? `${count} стр.` : ""}</span>
      <span style={{ flex: 1 }} />
      <a href={editHref} style={{ color: "#9aa0a6", textDecoration: "none" }}>
        редактировать форму
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        style={{ background: "#f6f7f8", color: "#0a0b0d", border: 0, padding: "8px 14px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
      >
        Печать (⌘P)
      </button>
    </div>
  );
}
