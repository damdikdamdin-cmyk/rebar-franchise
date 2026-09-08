import * as React from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "flex w-full rounded-md border border-input bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function Input({
  className,
  invalid,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        inputBase,
        "h-9 px-3",
        invalid && "border-red-600 ring-1 ring-red-600/30",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24 px-3 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(inputBase, "h-9 px-3", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({
  className,
  required,
  invalid,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean; invalid?: boolean }) {
  return (
    <label className={cn("eyebrow mb-1 block font-medium", invalid && "text-red-600", className)} {...props}>
      {children}
      {required ? (
        <span className={cn("ml-1 font-mono text-[10px] normal-case tracking-normal", invalid ? "text-red-600" : "text-muted-foreground")}>
          {invalid ? "обязательно" : "*"}
        </span>
      ) : null}
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"span"> & { tone?: "default" | "steel" | "ink" | "warn" | "success" }) {
  const tones = {
    default: "border-border text-foreground",
    steel: "border-transparent bg-secondary text-secondary-foreground",
    ink: "border-transparent bg-foreground text-background",
    warn: "border-transparent bg-warning/20 text-foreground",
    success: "border-transparent bg-success/15 text-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-border bg-card", className)} {...props} />;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="px-4 py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="display mt-1 text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const init = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] text-secondary-foreground",
        className,
      )}
    >
      {init}
    </span>
  );
}
