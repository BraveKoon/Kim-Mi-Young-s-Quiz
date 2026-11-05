import { AnimatePresence, motion } from 'framer-motion';

export function DoublePointsBanner({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.05, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-8 py-5 text-center font-display text-4xl text-amber-900 shadow-xl md:text-6xl"
          >
            ⚡ DOUBLE POINTS x2! ⚡
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
