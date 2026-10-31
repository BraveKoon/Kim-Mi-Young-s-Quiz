import { useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import type { Competition } from '../../types';
import { COMPETITION_STATUS_LABEL } from '../../utils/format';

export function CompetitionSelect({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const { data } = useApi<{ competitions: Competition[] }>('/competitions');
  useEffect(() => {
    if (value === null && data?.competitions.length) {
      const active = data.competitions.find((c) => c.status === 'ACTIVE') ?? data.competitions[0];
      onChange(active.id);
    }
  }, [data, value, onChange]);
  return (
    <select className="input max-w-md" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} aria-label="대회 선택">
      {!data && <option>불러오는 중…</option>}
      {data?.competitions.map((c) => (
        <option key={c.id} value={c.id} className="bg-ink-800">
          #{c.id} {c.title} ({COMPETITION_STATUS_LABEL[c.status]})
        </option>
      ))}
    </select>
  );
}

export function SectionTitle({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-3xl">{title}</h2>
        {desc && <p className="mt-1 text-sm text-white/60">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
