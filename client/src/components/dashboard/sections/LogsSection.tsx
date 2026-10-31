import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CLASS_IDS, LOG_EVENT_TYPES, classDisplayName } from '@shared/types/index';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { downloadFile, errorMessage } from '../../../services/api';
import { dateTime } from '../../../utils/format';
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
  QUIZ_STARTED: '퀴즈 시작',
  QUIZ_PAUSED: '일시정지',
  QUIZ_RESUMED: '재개',
  QUESTION_STARTED: '문제 출제',
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

const SEV: Record<string, string> = { info: 'text-white/60', warning: 'text-amber-300', critical: 'text-rose-300 font-bold' };

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
        <label className="flex items-center gap-1 text-sm">
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
      </SectionTitle>
      <div className="glass mb-3 grid gap-2 p-3 md:grid-cols-6">
        <input type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="시작 날짜" />
        <input type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="종료 날짜" />
        <select className="input" value={f.classId} onChange={(e) => set('classId', e.target.value)}>
          <option value="" className="bg-ink-800">전체 학급</option>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id} className="bg-ink-800">
              {classDisplayName(id)}
            </option>
          ))}
        </select>
        <select className="input" value={f.eventType} onChange={(e) => set('eventType', e.target.value)}>
          <option value="" className="bg-ink-800">전체 이벤트</option>
          {LOG_EVENT_TYPES.map((t) => (
            <option key={t} value={t} className="bg-ink-800">
              {EVENT_LABEL[t] ?? t}
            </option>
          ))}
        </select>
        <input className="input" placeholder="참가자 ID" inputMode="numeric" value={f.participantId} onChange={(e) => set('participantId', e.target.value.replace(/\D/g, ''))} />
        <select className="input" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
          <option value="" className="bg-ink-800">전체 수준</option>
          <option value="info" className="bg-ink-800">정보</option>
          <option value="warning" className="bg-ink-800">주의</option>
          <option value="critical" className="bg-ink-800">위험</option>
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
                <td className="whitespace-nowrap text-white/70">{dateTime(l.createdAt)}</td>
                <td className="whitespace-nowrap">{l.classId ? classDisplayName(l.classId) : '-'}</td>
                <td>{l.nickname ?? (l.participantId ? `#${l.participantId}` : '-')}</td>
                <td className="whitespace-nowrap">{EVENT_LABEL[l.eventType] ?? l.eventType}</td>
                <td className={SEV[l.severity]}>{l.severity}</td>
                <td className="max-w-md truncate font-mono text-xs text-white/60" title={l.details ? JSON.stringify(l.details) : ''}>
                  {l.details ? JSON.stringify(l.details) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-white/60">
        <span>총 {data?.total ?? 0}건</span>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전
          </button>
          <span className="px-2 py-1">{page + 1} 페이지</span>
          <button className="btn-ghost btn-sm" disabled={!data || (page + 1) * 100 >= data.total} onClick={() => setPage(page + 1)}>
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
