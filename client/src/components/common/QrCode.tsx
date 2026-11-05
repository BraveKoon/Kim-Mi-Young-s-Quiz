import { Check, Copy, QrCode as QrCodeIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { encodeQrMatrix } from '../../utils/qrcode';
import { Modal } from './Modal';

export interface QrCodeProps {
  /** QR 코드에 담을 문자열(URL 등) */
  value: string;
  /** 렌더링 픽셀 크기 (기본 200) */
  size?: number;
  /** 주변 여백 모듈 수 (ISO 표준 권장값 4) */
  margin?: number;
  /** 접근성 라벨 */
  label?: string;
  className?: string;
}

/**
 * 외부 네트워크 의존 없이 즉시 렌더링되는 고대비 SVG QR 코드 컴포넌트.
 * 인접 모듈을 가로 런(run) 단위의 단일 path로 병합하여 프로젝터 확대 시에도 경계 실선이 생기지 않습니다.
 */
export function QrCode({ value, size = 200, margin = 4, label, className = '' }: QrCodeProps) {
  const { dim, pathD } = useMemo(() => {
    const matrix = encodeQrMatrix(value);
    const n = matrix.length;
    const total = n + margin * 2;
    const segs: string[] = [];
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!matrix[r][c]) {
          c++;
          continue;
        }
        let run = 1;
        while (c + run < n && matrix[r][c + run]) run++;
        segs.push(`M${c + margin} ${r + margin}h${run}v1h-${run}z`);
        c += run;
      }
    }
    return { dim: total, pathD: segs.join('') };
  }, [value, margin]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? `${value} 접속 QR 코드`}
      data-testid="qr-code-svg"
      className={`block select-none rounded-xl bg-white ${className}`}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={pathD} fill="#0f172a" />
    </svg>
  );
}

/** 프로젝터 화면 어디서든 크게 띄울 수 있는 참가용 QR 모달 */
export function JoinQrModal({
  open,
  onClose,
  title,
  subtitle,
  url,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없는 환경에서는 무시
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        {subtitle && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-sm font-bold text-amber-900">
            <QrCodeIcon className="h-4 w-4 text-amber-700" />
            <span>{subtitle}</span>
          </div>
        )}

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
          <QrCode value={url} size={340} label={`${title} QR 코드`} className="max-w-[72vw] h-auto" />
        </div>

        <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="text-xs font-bold text-slate-700">접속 주소</div>
          <div className="mt-1 break-all font-display text-2xl text-brand-600 sm:text-3xl">
            {url.replace(/^https?:\/\//, '')}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-ghost" onClick={copyUrl}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-brand-600" />}
            {copied ? '주소 복사됨!' : '접속 주소 복사'}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}
