import type { SessionStatus } from '@shared/types/index';
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/format';

export function StatusBadge({ status, className = '' }: { status: SessionStatus | 'NO_SESSION'; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[status]} ${className}`}>
      {status === 'PLAYING' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
