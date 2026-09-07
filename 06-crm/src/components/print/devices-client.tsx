"use client";

import { useState } from "react";
import Link from "next/link";
import { useBarcodeScanner, BarcodeCameraButton } from "@/components/print/barcode-scanner";
import { Button } from "@/components/ui/button";

export function DevicesClient() {
  const [last, setLast] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [printOk, setPrintOk] = useState<string | null>(null);

  useBarcodeScanner((code) => {
    setLast(code);
    setLog((prev) => [`${new Date().toLocaleTimeString("ru-RU")} · ${code}`, ...prev].slice(0, 20));
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Настройки</p>
        <h1 className="mt-1 font-serif text-3xl">Устройства</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          USB-сканеры штрихкодов работают как клавиатура — подключите и проведите тест ниже. Принтеры (обычный, этикеточный) —
          через диалог печати браузера (⌘P / Ctrl+P): выберите нужный принтер и размер бумаги / этикетки.
        </p>
      </div>

      <section className="border border-border bg-card p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Сканер штрихкодов</h2>
        <p className="mt-2 text-sm">
          Наведите сканер сюда и пропищите штрихкод. Код появится ниже. В продажах (POS) и на остатках тот же ввод добавляет / находит
          товар.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BarcodeCameraButton
            onScan={(code) => {
              setLast(code);
              setLog((prev) => [`${new Date().toLocaleTimeString("ru-RU")} · камера · ${code}`, ...prev].slice(0, 20));
            }}
          />
          <span className="font-mono text-sm">{last ? `Последний код: ${last}` : "Ожидание скана…"}</span>
        </div>
        {log.length ? (
          <ul className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
            {log.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border border-border bg-card p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Принтеры</h2>
        <p className="mt-2 text-sm">
          Браузер не отдаёт список принтеров сайту (ограничение безопасности ОС). Откройте тестовую печать — в системном окне будут
          видны все подключённые устройства: лазерный/струйный, термопринтер чеков, принтер этикеток.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/print/label_43x25?sample=1&auto=1" target="_blank">
              Тест этикетки 43×25
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/print/price_big?sample=1&auto=1" target="_blank">
              Тест большого ценника
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/print/warranty?sample=1" target="_blank">
              Тест гарантийного талона (A4)
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.print();
              setPrintOk("Диалог печати открыт — выберите принтер в списке системы.");
            }}
          >
            Диалог печати системы
          </Button>
        </div>
        {printOk ? <p className="mt-3 text-sm text-muted-foreground">{printOk}</p> : null}
      </section>

      <section className="border border-border bg-card p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Распознавание штрихкодов</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>Каждая позиция каталога получает EAN-13 (префикс 200…) при создании, если штрихкод не задан вручную.</li>
          <li>На ценниках и этикетках печатается этот код; сканер в POS ищет товар по штрихкоду, коду или названию.</li>
          <li>Для серийных устройств на этикетке IMEI печатается Code128 с серийным номером.</li>
        </ul>
        <p className="mt-4">
          <Link href="/settings/print-forms" className="underline">
            Редактор печатных форм →
          </Link>
        </p>
      </section>
    </div>
  );
}
