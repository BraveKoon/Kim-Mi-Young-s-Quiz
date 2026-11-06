import { Download, FileSpreadsheet, FileText, HardDriveDownload, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, downloadFile, errorMessage } from '../../../services/api';
import { dateTime } from '../../../utils/format';
import { ConfirmDialog } from '../../common/Modal';
import { CompetitionSelect, SectionTitle } from '../CompetitionSelect';

const DATASETS = [
  { key: 'individual', label: '전체 개인 순위 (정답 수·정답률 포함)' },
  { key: 'class', label: '학급별 평균 순위' },
  { key: 'questions', label: '문항별 통계' },
  { key: 'logs', label: '접속 기록' },
];

export function ExportsSection() {
  const toast = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [cid, setCid] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const history = useApi<{ exports: { id: number; competitionId: number; exportType: string; fileName: string; stored: boolean; createdAt: number }[] }>('/exports');
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      history.reload();
    } catch (e) {
      toast(errorMessage(e, '내보내기에 실패했습니다.'), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <SectionTitle title="결과 내보내기" desc="서버에서 직접 CSV(UTF-8 BOM, 엑셀 한글 호환)와 XLSX 파일을 생성합니다. 외부 서비스로 데이터가 전송되지 않습니다.">
        <CompetitionSelect value={cid} onChange={setCid} />
      </SectionTitle>
      {cid && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass space-y-3 p-5">
            <h3 className="flex items-center gap-2 font-display text-xl text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Excel (XLSX)
            </h3>
            <p className="text-sm font-medium text-slate-600">대회 정보, 개인 순위, 학급 순위, 문항별 통계, 접속 기록이 시트별로 포함됩니다.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!!busy} onClick={() => run('xlsx', () => downloadFile(`/exports/${cid}/excel`, `quizbeat_${cid}.xlsx`))}>
                <Download className="h-4 w-4" /> {busy === 'xlsx' ? '생성 중…' : 'Excel 다운로드'}
              </button>
              <button
                className="btn-ghost"
                disabled={!!busy}
                onClick={() =>
                  run('save', async () => {
                    await api.post(`/exports/${cid}`, { format: 'xlsx' });
                    toast('서버에 파일을 저장했습니다.', 'success');
                  })
                }
              >
                <Save className="h-4 w-4" /> 서버에 저장
              </button>
            </div>
          </div>
          <div className="glass space-y-3 p-5">
            <h3 className="flex items-center gap-2 font-display text-xl text-slate-900">
              <FileText className="h-5 w-5 text-brand-600" /> CSV
            </h3>
            <div className="space-y-2">
              {DATASETS.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800">
                  <span>{d.label}</span>
                  <button className="btn-cyan btn-sm" disabled={!!busy} onClick={() => run(d.key, () => downloadFile(`/exports/${cid}/csv?type=${d.key}`, `quizbeat_${cid}_${d.key}.csv`))}>
                    <Download className="h-4 w-4" /> CSV
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="glass mt-6 overflow-x-auto p-2">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <h3 className="font-bold text-slate-900">내보내기 기록</h3>
          <button className="btn-ghost btn-sm text-rose-700" disabled={!history.data?.exports.length} onClick={() => setResetOpen(true)}>
            <Trash2 className="h-4 w-4" /> 기록 초기화
          </button>
        </div>
        <table className="table-base">
          <thead>
            <tr>
              <th>시각</th>
              <th>대회</th>
              <th>형식</th>
              <th>파일명</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.data?.exports.map((e) => (
              <tr key={e.id}>
                <td className="text-slate-500">{dateTime(e.createdAt)}</td>
                <td className="font-semibold text-brand-600">#{e.competitionId}</td>
                <td className="font-medium">{e.exportType}</td>
                <td className="max-w-xs truncate font-medium text-slate-900">{e.fileName}</td>
                <td>
                  {e.stored && (
                    <button className="btn-ghost btn-sm" onClick={() => run(`f${e.id}`, () => downloadFile(`/exports/files/${e.id}`, e.fileName))}>
                      <HardDriveDownload className="h-4 w-4 text-brand-600" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={resetOpen}
        danger
        title="내보내기 기록 초기화"
        requireTyping="RESET"
        confirmText="전체 삭제"
        message="내보내기 기록을 모두 지우고, 서버에 저장해 둔 내보내기 파일도 함께 삭제합니다. 이미 내려받은 파일에는 영향이 없습니다."
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          try {
            const r = await api.delete('/exports', { data: { confirm: 'RESET' } });
            toast(`내보내기 기록 ${r.data.deleted}건(저장 파일 ${r.data.filesDeleted}개)을 삭제했습니다.`, 'success');
            history.reload();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </div>
  );
}
