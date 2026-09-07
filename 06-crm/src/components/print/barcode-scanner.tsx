"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HID-сканеры штрихкодов работают как клавиатура: быстро вводят цифры и жмут Enter.
 * Слушаем окно, пока фокус не в текстовом поле (кроме самого поля поиска).
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const buf = useRef("");
  const last = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isField = tag === "INPUT" || tag === "TEXTAREA" || (t as HTMLElement)?.isContentEditable;
      const isSearch = t?.getAttribute("data-barcode-input") === "1";
      if (isField && !isSearch) return;

      const now = Date.now();
      if (now - last.current > 80) buf.current = "";
      last.current = now;

      if (e.key === "Enter") {
        const code = buf.current.trim();
        buf.current = "";
        if (code.length >= 4) {
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }
      if (e.key.length === 1) {
        buf.current += e.key;
        if (buf.current.length > 64) buf.current = buf.current.slice(-64);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

export function BarcodeCameraButton({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      try {
        if (!("BarcodeDetector" in window)) {
          setErr("Камера-сканер не поддерживается в этом браузере. Используйте USB-сканер или ввод кода вручную.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // @ts-expect-error BarcodeDetector — экспериментальный API
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a"] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              onScan(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            /* кадр ещё не готов */
          }
          timer = window.setTimeout(tick, 400);
        };
        timer = window.setTimeout(tick, 500);
      } catch {
        setErr("Нет доступа к камере");
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onScan]);

  return (
    <>
      <button
        type="button"
        className="border border-border px-2 py-1 font-mono text-[10px] uppercase"
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
      >
        Камера
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase">Сканер камеры</p>
              <button type="button" className="text-sm" onClick={() => setOpen(false)}>
                Закрыть
              </button>
            </div>
            {err ? <p className="text-sm text-muted-foreground">{err}</p> : <video ref={videoRef} className="aspect-video w-full bg-black object-cover" muted playsInline />}
          </div>
        </div>
      ) : null}
    </>
  );
}
