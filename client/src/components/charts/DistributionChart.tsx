import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OPTION_STYLES } from '../../utils/format';

/** 보기별 선택 인원 (정답 보기는 테두리 강조) */
export function DistributionChart({ options, distribution, correctIndex, height = 220 }: { options: string[]; distribution: number[]; correctIndex: number; height?: number }) {
  const data = options.map((o, i) => ({ name: `${OPTION_STYLES[i].shape} ${o}`, value: distribution[i] ?? 0, i }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.75)', fontSize: 12 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e1048', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }} formatter={(v) => [`${v}명`, '선택']} />
        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.i} fill={OPTION_STYLES[d.i].hex} stroke={d.i === correctIndex ? '#a3ff3d' : 'none'} strokeWidth={d.i === correctIndex ? 4 : 0} opacity={d.i === correctIndex ? 1 : 0.65} />
          ))}
          <LabelList dataKey="value" position="top" fill="#fff" formatter={(v) => `${v}명`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
