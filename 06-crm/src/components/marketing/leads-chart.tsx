"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function LeadsChart({ data }: { data: Array<{ week: string; leads: number; qualified: number }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
          />
          <Bar dataKey="leads" name="Заявки" fill="var(--chart-2)" radius={2} />
          <Bar dataKey="qualified" name="Квалифицированы" fill="var(--chart-1)" radius={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
