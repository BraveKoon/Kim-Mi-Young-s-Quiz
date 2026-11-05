import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { OPTION_STYLES } from '../../utils/format';

type Mode = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

export function AnswerButton(props: { index: number; text: string; mode: Mode; disabled?: boolean; onClick?: () => void; large?: boolean; count?: number }) {
  const s = OPTION_STYLES[props.index];
  const dim = props.mode === 'dim' || props.mode === 'wrong';
  return (
    <motion.button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      whileHover={props.disabled ? undefined : { scale: 1.02, y: -2 }}
      whileTap={props.disabled ? undefined : { scale: 0.95 }}
      animate={props.mode === 'selected' ? { scale: [1, 1.05, 0.98, 1.01, 1] } : props.mode === 'correct' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={
        props.mode === 'selected' || props.mode === 'correct'
          ? { duration: 0.35, ease: 'easeOut' }
          : { type: 'spring', stiffness: 400, damping: 14 }
      }
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl ${s.bg} px-4 text-left font-bold text-white transition
        ${props.large ? `min-h-28 py-5 text-2xl md:text-4xl [@media(max-height:820px)]:min-h-16 [@media(max-height:820px)]:py-2.5 [@media(max-height:820px)]:text-2xl` : 'min-h-20 py-4 text-lg md:text-2xl'}
        ${props.mode === 'selected' ? `ring-4 ${s.ring} ring-offset-2 ring-offset-white` : ''}
        ${props.mode === 'correct' ? 'ring-4 ring-lime-300 ring-offset-2 ring-offset-white' : ''}
        ${dim ? 'opacity-40 saturate-50' : ''}
        disabled:cursor-default`}
      aria-label={`${props.index + 1}번 ${s.name}: ${props.text}`}
    >
      <span className={`grid shrink-0 place-items-center rounded-xl bg-black/15 ${props.large ? `h-16 w-16 text-4xl [@media(max-height:820px)]:h-11 [@media(max-height:820px)]:w-11 [@media(max-height:820px)]:text-2xl` : 'h-12 w-12 text-2xl'}`}>{s.shape}</span>
      <span className="flex-1 break-keep">{props.text}</span>
      {props.count !== undefined && <span className="rounded-full bg-black/20 px-3 py-1 text-base">{props.count}명</span>}
      {props.mode === 'correct' && <Check className="h-8 w-8 shrink-0" strokeWidth={4} />}
      {props.mode === 'wrong' && <X className="h-8 w-8 shrink-0" strokeWidth={4} />}
    </motion.button>
  );
}
