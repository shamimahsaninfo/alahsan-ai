import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Spec = { type?: "bar" | "line" | "pie"; title?: string; data: { name: string; value: number }[] };
const COLORS = ["hsl(var(--primary))", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

export function ChartBlock({ json }: { json: string }) {
  let spec: Spec | null = null;
  try {
    const p = JSON.parse(json);
    if (Array.isArray(p?.data)) spec = { ...p, data: p.data.map((d: any) => ({ name: String(d.name), value: Number(d.value) || 0 })) };
  } catch {}

  if (!spec) return <pre className="text-xs"><code>{json}</code></pre>;

  return (
    <div className="not-prose my-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      {spec.title && <div className="mb-2 text-sm font-semibold text-primary">{spec.title}</div>}
      <div className="h-72 w-full">
        <ResponsiveContainer>
          {spec.type === "pie" ? (
            <PieChart>
              <Pie data={spec.data} dataKey="value" nameKey="name" outerRadius={90} label>
                {spec.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : spec.type === "line" ? (
            <LineChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip />
              <Line dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} />
            </LineChart>
          ) : (
            <BarChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
