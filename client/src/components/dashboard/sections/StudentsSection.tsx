import { RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CLASS_IDS, EVENTS, classDisplayName } from '@shared/types/index';
import { useAdminSocket } from '../../../contexts/AdminSocketContext';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, errorMessage } from '../../../services/api';
import { dateTime, num } from '../../../utils/format';
import { ConfirmDialog } from '../../common/Modal';
import { SectionTitle } from '../CompetitionSelect';

interface P {
  id: number;
  nickname: string;
  connected: boolean;
  totalScore: number;
  correctCount: number;
  answerCount: number;
  lastSeenAt: number | null;
  createdAt: number;
}

export function StudentsSection() {
  const toast = useToast();
  const { socket } = useAdminSocket();
  const [classId, setClassId] = useState('2-1');
  const { data, reload } = useApi<{ participants: P[] }>(`/classes/${classId}/participants`);
  const [remove, setRemove] = useState<P | null>(null);

  // 접속 상태 실시간 갱신
  useEffect(() => {
    if (!socket) return;
    const h = (p: { classId: string }) => p.classId === classId && reload();
    socket.emit(EVENTS.ADMIN_WATCH, { classId }, () => {});
    socket.on(EVENTS.PARTICIPANTS, h);
    return () => {
      socket.off(EVENTS.PARTICIPANTS, h);
    };
  }, [socket, classId, reload]);

  const list = data?.participants ?? [];
  return (
    <div>
      <SectionTitle title="학생 관리" desc="학급별 참가 학생과 접속 상태를 확인하고, 필요하면 참가자를 제외합니다. 연결이 끊겨도 기록은 보존되어 재접속할 수 있습니다.">
        <select className="input w-40 font-semibold" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {CLASS_IDS.map((id) => (
            <option key={id} value={id} className="bg-white text-slate-900">
              {classDisplayName(id)}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </SectionTitle>
      <div className="mb-3 text-sm font-semibold text-slate-600">
        참가 <b className="text-slate-900">{list.length}</b>/35명 · 접속 <b className="text-emerald-700">{list.filter((p) => p.connected).length}</b>명 · 미접속 {list.filter((p) => !p.connected).length}명
      </div>
      <div className="glass overflow-x-auto p-2">
        <table className="table-base">
          <thead>
            <tr>
              <th>#</th>
              <th>닉네임</th>
              <th>접속</th>
              <th>점수</th>
              <th>정답/응답</th>
              <th>마지막 접속</th>
              <th>입장 시각</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={p.id}>
                <td className="text-slate-400">{i + 1}</td>
                <td className="font-bold text-slate-900">{p.nickname}</td>
                <td>{p.connected ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-slate-300" />}</td>
                <td className="font-semibold">{num(p.totalScore)}</td>
                <td>
                  {p.correctCount}/{p.answerCount}
                </td>
                <td className="text-slate-500">{dateTime(p.lastSeenAt)}</td>
                <td className="text-slate-500">{dateTime(p.createdAt)}</td>
                <td>
                  <button className="btn-ghost btn-sm text-rose-600 hover:border-rose-200 hover:bg-rose-50" onClick={() => setRemove(p)} aria-label={`${p.nickname} 제외`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  아직 입장한 학생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!remove}
        danger
        title="참가자 제외"
        message={`'${remove?.nickname}' 학생을 제외할까요? 이 학생의 답안과 점수도 삭제됩니다.`}
        confirmText="제외"
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          try {
            await api.delete(`/classes/${classId}/participants/${remove!.id}`);
            toast('제외했습니다.', 'success');
            reload();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </div>
  );
}
