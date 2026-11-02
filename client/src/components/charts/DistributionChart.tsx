import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OPTION_STYLES } from '../../utils/format';

/** 보기별 선택 인원 (정답 보기는 테두리 강조) */
export function DistributionChart({ options, distribution, correctIndex, height = 220 }: { options: string[]; distribution: number[]; correctIndex: number; height?: number }) {
  const data = options.map((o, i) => ({ name: `${OPTION_STYLES[i].shape} ${o}`, value: distribution[i] ?? 0, i }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }}
          contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, color: '#0f172a', boxShadow: '0 8px 20px -6px rgba(15,23,42,0.12)' }}
          formatter={(v) => [`${v}명`, '선택']}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.i} fill={OPTION_STYLES[d.i].hex} stroke={d.i === correctIndex ? '#10b981' : 'none'} strokeWidth={d.i === correctIndex ? 3 : 0} opacity={d.i === correctIndex ? 1 : 0.7} />
          ))}
          <LabelList dataKey="value" position="top" fill="#1e293b" style={{ fontWeight: 700, fontSize: 12 }} formatter={(v) => `${v}명`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
