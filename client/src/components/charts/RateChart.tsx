import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** 문항별 정답률 (응답자 기준 vs 전체 참가자 기준) */
export function RateChart({ data, onSelect, height = 280 }: { data: { label: string; answered: number; all: number; id: number }[]; onSelect?: (id: number) => void; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data.map((d) => ({ ...d, answered: Math.round(d.answered * 1000) / 10, all: Math.round(d.all * 1000) / 10 }))}
        margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
        onClick={(e) => {
          const idx = Number(e?.activeTooltipIndex);
          if (onSelect && Number.isInteger(idx) && data[idx]) onSelect(data[idx].id);
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-slate-700)', fontSize: 12, fontWeight: 600 }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
          contentStyle={{ background: 'var(--color-white)', border: '1px solid var(--color-slate-300)', borderRadius: 12, color: 'var(--color-slate-900)', boxShadow: '0 8px 20px -6px rgba(15,23,42,0.12)' }}
          formatter={(v) => `${v}%`}
        />
        <Legend wrapperStyle={{ color: 'var(--color-slate-700)', fontSize: 13, fontWeight: 600 }} />
        <Bar dataKey="answered" name="정답률(응답자 기준)" fill="#2563eb" radius={[6, 6, 0, 0]} cursor="pointer" />
        <Bar dataKey="all" name="정답률(전체 참가자 기준)" fill="#14b8a6" radius={[6, 6, 0, 0]} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  );
}
