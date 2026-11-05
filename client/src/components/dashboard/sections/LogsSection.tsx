import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CLASS_IDS, LOG_EVENT_TYPES, classDisplayName } from '@shared/types/index';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, downloadFile, errorMessage } from '../../../services/api';
import { dateTime } from '../../../utils/format';
import { ConfirmDialog } from '../../common/Modal';
import { SectionTitle } from '../CompetitionSelect';

interface Log {
  id: number;
  classId: string | null;
  participantId: number | null;
  nickname: string | null;
  eventType: string;
  severity: string;
  details: Record<string, unknown> | null;
  createdAt: number;
}

export const EVENT_LABEL: Record<string, string> = {
  STUDENT_JOINED: '학생 입장',
  STUDENT_CONNECTED: '접속',
  STUDENT_RECONNECTED: '재접속',
  STUDENT_DISCONNECTED: '연결 종료',
  CONNECTION_REPLACED: '중복 접속(교체)',
  STUDENT_REMOVED: '참가자 제외',
  DUPLICATE_ANSWER: '중복 답안 시도',
  LATE_ANSWER: '제한시간 후 제출',
  ANSWER_WHEN_CLOSED: '마감/종료 후 제출',
  INVALID_ANSWER: '잘못된 답안',
  UNAUTHORIZED_ADMIN_EVENT: '권한 없는 관리자 이벤트',
  INVALID_ROOM_ACCESS: '잘못된 Room 접근',
  INVALID_PARTICIPANT: '잘못된 참가자 인증',
  RATE_LIMITED: '비정상 요청 반복',
  ADMIN_LOGIN: '관리자 로그인',
  ADMIN_LOGIN_FAILED: '관리자 로그인 실패',
  ADMIN_PASSWORD_CHANGED: '비밀번호 변경',
  ADMIN_CREATED: '관리자 계정 추가',
  ADMIN_DELETED: '관리자 계정 삭제',
  PROJECTOR_KEY_ISSUED: '프로젝터 진행 컨트롤 열기',
  LOGS_RESET: '활동 로그 초기화',
  EXPORTS_RESET: '내보내기 기록 초기화',
  QUIZ_STARTED: '퀴즈 시작',
  QUIZ_PAUSED: '일시정지',
  QUIZ_RESUMED: '재개',
  QUESTION_STARTED: '문제 출제',
  QUESTION_SKIPPED: '문제 건너뛰기',
  RESULTS_SHOWN: '결과 공개',
  QUIZ_FINISHED: '퀴즈 종료',
  SESSION_CREATED: '세션 생성',
  CLASS_RESET: '학급 초기화',
  ALL_RESET: '전체 초기화',
  LEADERBOARD_RESET: '결과 초기화',
  DATA_EXPORTED: '데이터 내보내기',
  COMPETITION_DELETED: '대회 삭제',
  SERVER_RECOVERED: '서버 복구',
};

const SEV: Record<string, string> = {
  info: 'text-slate-500 font-medium',
  warning: 'text-amber-700 font-bold',
  critical: 'text-rose-600 font-extrabold',
};

export function LogsSection() {
  const toast = useToast();
  const { onLog } = useAdminSocket();
  const [f, setF] = useState({ from: '', to: '', classId: '', eventType: '', participantId: '', severity: '' });
  const [page, setPage] = useState(0);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (f.from) p.set('from', String(new Date(f.from).getTime()));
    if (f.to) p.set('to', String(new Date(f.to).getTime() + 86399999));
    for (const k of ['classId', 'eventType', 'participantId', 'severity'] as const) if (f[k]) p.set(k, f[k]);
    return p;
  }, [f]);
  const listQuery = new URLSearchParams(query);
  listQuery.set('limit', '100');
  listQuery.set('offset', String(page * 100));
  const { data, reload } = useApi<{ total: number; logs: Log[] }>(`/logs?${listQuery}`);
  const [live, setLive] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!live) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    return onLog(() => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        if (page === 0) reload();
      }, 1000);
    });
  }, [live, onLog, reload, page]);

  const set = (k: keyof typeof f, v: string) => {
    setPage(0);
    setF({ ...f, [k]: v });
  };
  return (
    <div>
      <SectionTitle title="활동 로그" desc="접속·재접속, 비정상 제출 시도, 권한 위반, 관리자 작업이 기록됩니다. 네트워크 오류나 새로고침은 부정행위로 단정하지 않습니다.">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> 실시간 갱신
        </label>
        <button className="btn-ghost" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          className="btn-cyan"
          onClick={() => downloadFile(`/logs/csv?${query}`, 'activity_logs.csv').catch((e) => toast(errorMessage(e), 'error'))}
        >
          <Download className="h-4 w-4" /> CSV
        </button>
        <button className="btn-ghost text-rose-700" onClick={() => setResetOpen(true)}>
          <Trash2 className="h-4 w-4" /> 로그 초기화
        </button>
      </SectionTitle>
      <div className="glass mb-3 grid gap-2 p-3 md:grid-cols-6">
        <input type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="시작 날짜" />
        <input type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="종료 날짜" />
        <select className="input" value={f.classId} onChange={(e) => set('classId', e.target.value)}>
          <option value="" className="bg-white text-slate-900">전체 학급</option>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id} className="bg-white text-slate-900">
              {classDisplayName(id)}
            </option>
          ))}
        </select>
        <select className="input" value={f.eventType} onChange={(e) => set('eventType', e.target.value)}>
          <option value="" className="bg-white text-slate-900">전체 이벤트</option>
          {LOG_EVENT_TYPES.map((t) => (
            <option key={t} value={t} className="bg-white text-slate-900">
              {EVENT_LABEL[t] ?? t}
            </option>
          ))}
        </select>
        <input className="input" placeholder="참가자 ID" inputMode="numeric" value={f.participantId} onChange={(e) => set('participantId', e.target.value.replace(/\D/g, ''))} />
        <select className="input" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
          <option value="" className="bg-white text-slate-900">전체 수준</option>
          <option value="info" className="bg-white text-slate-900">정보</option>
          <option value="warning" className="bg-white text-slate-900">주의</option>
          <option value="critical" className="bg-white text-slate-900">위험</option>
        </select>
      </div>
      <div className="glass max-h-[65vh] overflow-auto p-2">
        <table className="table-base">
          <thead>
            <tr>
              <th>시각</th>
              <th>학급</th>
              <th>참가자</th>
              <th>이벤트</th>
              <th>수준</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {data?.logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-slate-500">{dateTime(l.createdAt)}</td>
                <td className="whitespace-nowrap font-medium">{l.classId ? classDisplayName(l.classId) : '-'}</td>
                <td className="font-semibold text-slate-900">{l.nickname ?? (l.participantId ? `#${l.participantId}` : '-')}</td>
                <td className="whitespace-nowrap font-semibold text-slate-800">{EVENT_LABEL[l.eventType] ?? l.eventType}</td>
                <td className={SEV[l.severity]}>{l.severity}</td>
                <td className="max-w-md truncate font-mono text-xs text-slate-500" title={l.details ? JSON.stringify(l.details) : ''}>
                  {l.details ? JSON.stringify(l.details) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>총 {data?.total ?? 0}건</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전
          </button>
          <span className="px-2 py-1 text-slate-900">{page + 1} 페이지</span>
          <button className="btn-ghost btn-sm" disabled={!data || (page + 1) * 100 >= data.total} onClick={() => setPage(page + 1)}>
            다음
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={resetOpen}
        danger
        title="활동 로그 초기화"
        requireTyping="RESET"
        confirmText="전체 삭제"
        message="저장된 활동 로그를 모두 삭제합니다. 되돌릴 수 없으니 필요하면 먼저 CSV로 내려받으세요. 초기화한 사실은 새 로그 1건으로 남습니다."
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          try {
            const r = await api.delete('/logs', { data: { confirm: 'RESET' } });
            toast(`활동 로그 ${r.data.deleted}건을 삭제했습니다.`, 'success');
            setPage(0);
            reload();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </div>
  );
}
