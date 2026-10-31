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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#172238', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} formatter={(v) => `${v}%`} />
        <Legend wrapperStyle={{ color: '#fff' }} />
        <Bar dataKey="answered" name="정답률(응답자 기준)" fill="#38bdf8" radius={[6, 6, 0, 0]} cursor="pointer" />
        <Bar dataKey="all" name="정답률(전체 참가자 기준)" fill="#818cf8" radius={[6, 6, 0, 0]} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  );
}
