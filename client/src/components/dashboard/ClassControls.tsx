import { CheckSquare, Flag, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useState } from 'react';
import { EVENTS, type SessionStatus } from '@shared/types/index';
import { useAdminSocket } from '../../contexts/AdminSocketContext';
import { ConfirmDialog } from '../common/Modal';

/** 학급별 퀴즈 진행 버튼 — 현재 상태에서 가능한 동작만 활성화 */
export function ClassControls({ classId, status, questionIndex, totalQuestions, compact }: { classId: string; status: SessionStatus | 'NO_SESSION'; questionIndex: number; totalQuestions: number; compact?: boolean }) {
  const { command } = useAdminSocket();
  const [confirm, setConfirm] = useState<'finish' | 'reset' | null>(null);
  const sm = compact ? 'btn-sm' : '';
  const isLast = questionIndex + 1 >= totalQuestions;
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'WAITING' && (
        <button className={`btn-primary ${sm}`} onClick={() => command(EVENTS.ADMIN_START, { classId }, '퀴즈를 시작했습니다.')}>
          <Play className="h-4 w-4" /> 시작
        </button>
      )}
      {status === 'PLAYING' && (
        <>
          <button className={`btn-ghost ${sm}`} onClick={() => command(EVENTS.ADMIN_PAUSE, { classId })}>
            <Pause className="h-4 w-4" /> 일시정지
          </button>
          <button className={`btn-cyan ${sm}`} onClick={() => command(EVENTS.ADMIN_SHOW_RESULTS, { classId })}>
            <CheckSquare className="h-4 w-4" /> 결과 공개
          </button>
        </>
      )}
      {status === 'PAUSED' && (
        <>
          <button className={`btn-primary ${sm}`} onClick={() => command(EVENTS.ADMIN_RESUME, { classId })}>
            <Play className="h-4 w-4" /> 재개
          </button>
          <button className={`btn-cyan ${sm}`} onClick={() => command(EVENTS.ADMIN_SHOW_RESULTS, { classId })}>
            <CheckSquare className="h-4 w-4" /> 결과 공개
          </button>
        </>
      )}
      {status === 'RESULT' && (
        <button className={`btn-primary ${sm}`} onClick={() => command(EVENTS.ADMIN_NEXT, { classId })}>
          {isLast ? <Flag className="h-4 w-4" /> : <SkipForward className="h-4 w-4" />} {isLast ? '최종 순위 발표' : '다음 문제'}
        </button>
      )}
      {['PLAYING', 'PAUSED', 'RESULT', 'WAITING'].includes(status) && (
        <button className={`btn-ghost ${sm}`} onClick={() => setConfirm('finish')}>
          <Flag className="h-4 w-4" /> 종료
        </button>
      )}
      {status !== 'NO_SESSION' && (
        <button className={`btn-ghost ${sm} text-rose-200`} onClick={() => setConfirm('reset')}>
          <RotateCcw className="h-4 w-4" /> 초기화
        </button>
      )}
      <ConfirmDialog
        open={confirm === 'finish'}
        title="퀴즈 종료"
        message={`${classId}반 퀴즈를 지금 종료할까요? 현재까지의 점수로 최종 순위가 확정됩니다.`}
        confirmText="종료"
        onClose={() => setConfirm(null)}
        onConfirm={() => command(EVENTS.ADMIN_FINISH, { classId }, '퀴즈를 종료했습니다.')}
      />
      <ResetDialog classId={classId} open={confirm === 'reset'} onClose={() => setConfirm(null)} />
    </div>
  );
}

function ResetDialog({ classId, open, onClose }: { classId: string; open: boolean; onClose: () => void }) {
  const { command } = useAdminSocket();
  const [removeParticipants, setRemove] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      danger
      title="학급 진행 상태 초기화"
      requireTyping="RESET"
      confirmText="초기화"
      onClose={onClose}
      onConfirm={() => command(EVENTS.ADMIN_RESET_CLASS, { classId, confirm: 'RESET', removeParticipants }, '초기화했습니다.')}
      message={
        <div className="space-y-3">
          <p>{classId}반의 현재 세션 답안과 점수를 모두 지우고 대기 상태로 되돌립니다. 종료된 대회 기록은 보존되며 초기화할 수 없습니다.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={removeParticipants} onChange={(e) => setRemove(e.target.checked)} /> 참가 학생 목록도 삭제 (학생들은 다시 입장해야 함)
          </label>
        </div>
      }
    />
  );
}
