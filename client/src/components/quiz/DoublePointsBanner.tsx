import { AnimatePresence, motion } from 'framer-motion';

export function DoublePointsBanner({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            initial={{ scale: 0.2, rotate: -8, opacity: 0 }}
            animate={{ scale: [0.2, 1.25, 1], rotate: [-8, 3, 0], opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="px-6 text-center font-display text-5xl text-neon-yellow md:text-8xl"
            style={{ textShadow: '0 0 18px #ffd53d, 0 0 42px #ff3dbb, 0 0 80px #a855f7' }}
          >
            <motion.div animate={{ opacity: [1, 0.6, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}>
              ⚡ DOUBLE POINTS x2! ⚡
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
