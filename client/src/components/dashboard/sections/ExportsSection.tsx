import { Download, FileSpreadsheet, FileText, HardDriveDownload, Save } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useApi } from '../../../hooks/useApi';
import { api, downloadFile, errorMessage } from '../../../services/api';
import { dateTime } from '../../../utils/format';
import { CompetitionSelect, SectionTitle } from '../CompetitionSelect';

const DATASETS = [
  { key: 'individual', label: '전체 개인 순위 (정답 수·정답률 포함)' },
  { key: 'class', label: '학급별 평균 순위' },
  { key: 'questions', label: '문항별 통계' },
  { key: 'logs', label: '접속 기록' },
];

export function ExportsSection() {
  const toast = useToast();
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
            <h3 className="flex items-center gap-2 font-display text-xl">
              <FileSpreadsheet className="h-5 w-5 text-lime-300" /> Excel (XLSX)
            </h3>
            <p className="text-sm text-white/60">대회 정보, 개인 순위, 학급 순위, 문항별 통계, 접속 기록이 시트별로 포함됩니다.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!!busy} onClick={() => run('xlsx', () => downloadFile(`/exports/${cid}/excel`, `classquiz_${cid}.xlsx`))}>
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
            <h3 className="flex items-center gap-2 font-display text-xl">
              <FileText className="h-5 w-5 text-cyan-300" /> CSV
            </h3>
            <div className="space-y-2">
              {DATASETS.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                  <span>{d.label}</span>
                  <button className="btn-cyan btn-sm" disabled={!!busy} onClick={() => run(d.key, () => downloadFile(`/exports/${cid}/csv?type=${d.key}`, `classquiz_${cid}_${d.key}.csv`))}>
                    <Download className="h-4 w-4" /> CSV
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="glass mt-6 overflow-x-auto p-2">
        <h3 className="px-2 py-2 font-bold">내보내기 기록</h3>
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
                <td>{dateTime(e.createdAt)}</td>
                <td>#{e.competitionId}</td>
                <td>{e.exportType}</td>
                <td className="max-w-xs truncate">{e.fileName}</td>
                <td>
                  {e.stored && (
                    <button className="btn-ghost btn-sm" onClick={() => run(`f${e.id}`, () => downloadFile(`/exports/files/${e.id}`, e.fileName))}>
                      <HardDriveDownload className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
