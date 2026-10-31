import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { LeaderboardEntry } from '@shared/types/index';
import { celebrate } from '../../utils/confetti';
import { num } from '../../utils/format';

/** 1~3위 시상대. 3위 → 2위 → 1위 순으로 등장한다. */
export function Podium({ entries, large, confetti = true }: { entries: LeaderboardEntry[]; large?: boolean; confetti?: boolean }) {
  const first = entries.filter((e) => e.rank === 1);
  const second = entries.filter((e) => e.rank === 2);
  const third = entries.filter((e) => e.rank === 3);
  useEffect(() => {
    if (!confetti || !entries.length) return;
    const t = setTimeout(() => celebrate(true), 2200);
    return () => clearTimeout(t);
  }, [confetti, entries.length]);
  const cols = [
    { list: second, place: 2, h: large ? 'h-48' : 'h-28', color: 'from-slate-200 to-slate-500', delay: 1.0 },
    { list: first, place: 1, h: large ? 'h-72' : 'h-40', color: 'from-yellow-200 to-amber-500', delay: 2.0 },
    { list: third, place: 3, h: large ? 'h-36' : 'h-20', color: 'from-orange-300 to-amber-800', delay: 0.2 },
  ];
  return (
    <div className="flex items-end justify-center gap-3 md:gap-6">
      {cols.map((c) => (
        <motion.div key={c.place} className="flex w-1/3 max-w-64 flex-col items-center" initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: c.delay, type: 'spring', stiffness: 120, damping: 14 }}>
          <div className="mb-2 min-h-16 text-center">
            {c.list.length ? (
              c.list.map((e) => (
                <div key={e.participantId}>
                  <div className={`font-display ${large ? 'text-4xl' : 'text-xl'} break-all`}>{e.nickname}</div>
                  <div className={`font-bold text-white/70 ${large ? 'text-2xl' : 'text-sm'}`}>{num(e.totalScore)}점</div>
                </div>
              ))
            ) : (
              <div className="text-white/30">-</div>
            )}
          </div>
          <div className={`flex w-full ${c.h} items-start justify-center rounded-t-3xl bg-gradient-to-b ${c.color} pt-3 shadow-[0_0_40px_rgba(255,213,61,0.25)]`}>
            <span className={`font-display text-ink-950 ${large ? 'text-7xl' : 'text-4xl'}`}>{c.place}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
