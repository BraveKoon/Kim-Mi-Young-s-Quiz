import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`glass-strong max-h-[90vh] w-full overflow-hidden ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="max-h-[calc(90vh-6px)] overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="font-display text-2xl text-slate-900">{title}</h3>
                <button
                  type="button"
                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={onClose}
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 위험한 작업 확인: 지정한 문구를 정확히 입력해야 실행 */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  requireTyping?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !props.requireTyping || typed === props.requireTyping;
  const close = () => {
    setTyped('');
    props.onClose();
  };
  return (
    <Modal open={props.open} onClose={close} title={props.title}>
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-slate-700">{props.message}</div>
        {props.requireTyping && (
          <div>
            <label className="label">
              확인을 위해 <b className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">{props.requireTyping}</b> 을(를) 입력하세요
            </label>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={close}>
            취소
          </button>
          <button
            className={props.danger ? 'btn-danger' : 'btn-primary'}
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await props.onConfirm();
                close();
              } finally {
                setBusy(false);
              }
            }}
          >
            {props.confirmText ?? '확인'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
