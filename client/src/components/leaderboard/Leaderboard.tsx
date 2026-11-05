import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Crown, Minus } from 'lucide-react';
import type { LeaderboardEntry } from '@shared/types/index';
import { classDisplayName } from '@shared/types/index';
import { num } from '../../utils/format';

/** 순위 변화 애니메이션이 있는 리더보드 (layout 애니메이션으로 자리 이동) */
export function Leaderboard({
  entries,
  highlightId,
  large,
  showClass,
  showLast = true,
  max,
}: {
  entries: LeaderboardEntry[];
  highlightId?: number;
  large?: boolean;
  showClass?: boolean;
  showLast?: boolean;
  max?: number;
}) {
  const list = max ? entries.slice(0, max) : entries;
  if (!list.length) return <p className="py-6 text-center text-slate-500">아직 순위가 없습니다.</p>;
  return (
    <ol className="space-y-2">
      <AnimatePresence initial={false}>
        {list.map((e, i) => {
          const delta = e.prevRank != null ? e.prevRank - e.rank : 0;
          const medal =
            e.rank === 1
              ? 'bg-amber-300 text-amber-950'
              : e.rank === 2
                ? 'bg-slate-300 text-slate-900'
                : e.rank === 3
                  ? 'bg-orange-300 text-amber-950'
                  : 'bg-slate-100 text-slate-700';
          return (
            <motion.li
              layout
              key={e.participantId}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(i * 0.03, 0.4) }}
              className={`flex items-center gap-3 rounded-xl border px-3 ${large ? 'py-3 text-2xl' : 'py-2'} ${
                e.participantId === highlightId
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <span className={`grid shrink-0 place-items-center rounded-xl font-display ${medal} ${large ? 'h-12 w-12 text-2xl' : 'h-9 w-9'}`}>
                {e.rank === 1 ? <Crown className="h-5 w-5" /> : e.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold text-slate-900">
                {e.nickname}
                {showClass && <span className="ml-2 text-sm font-medium text-slate-500">{classDisplayName(e.classId)}</span>}
              </span>
              {showLast && e.lastAwarded > 0 && <span className="text-sm font-extrabold text-emerald-600">+{num(e.lastAwarded)}</span>}
              {e.prevRank != null && (
                <span className={`flex w-10 items-center justify-end text-xs font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {delta > 0 ? <ArrowUp className="h-4 w-4" /> : delta < 0 ? <ArrowDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  {delta !== 0 && Math.abs(delta)}
                </span>
              )}
              <span className={`w-24 text-right font-display tabular-nums text-slate-900 ${large ? 'text-3xl' : 'text-lg'}`}>{num(e.totalScore)}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
