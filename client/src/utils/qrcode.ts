/**
 * ISO/IEC 18004 표준 호환 경량 QR 코드 생성기 (Byte 모드 · 오류 복원 수준 M, 버전 1~10)
 * 외부 API 호출이나 추가 패키지 없이 브라우저·오프라인 교실 환경에서 즉시 선명한 SVG QR 코드를 렌더링합니다.
 */

interface VersionSpec {
  version: number;
  ecCodewordsPerBlock: number;
  /** [블록 개수, 블록당 데이터 코드워드 수] 그룹 목록 */
  groups: readonly (readonly [count: number, dataCodewords: number])[];
  alignment: readonly number[];
}

/** ISO/IEC 18004 Table 9 & Table E.1 (Error Correction Level M = 약 15% 복원) */
const VERSION_SPECS: readonly VersionSpec[] = [
  { version: 1, ecCodewordsPerBlock: 10, groups: [[1, 16]], alignment: [] },
  { version: 2, ecCodewordsPerBlock: 16, groups: [[1, 28]], alignment: [6, 18] },
  { version: 3, ecCodewordsPerBlock: 26, groups: [[1, 44]], alignment: [6, 22] },
  { version: 4, ecCodewordsPerBlock: 18, groups: [[2, 32]], alignment: [6, 26] },
  { version: 5, ecCodewordsPerBlock: 24, groups: [[2, 43]], alignment: [6, 30] },
  { version: 6, ecCodewordsPerBlock: 16, groups: [[4, 27]], alignment: [6, 34] },
  { version: 7, ecCodewordsPerBlock: 18, groups: [[4, 31]], alignment: [6, 22, 38] },
  { version: 8, ecCodewordsPerBlock: 22, groups: [[2, 38], [2, 39]], alignment: [6, 24, 42] },
  { version: 9, ecCodewordsPerBlock: 22, groups: [[3, 36], [2, 37]], alignment: [6, 26, 46] },
  { version: 10, ecCodewordsPerBlock: 26, groups: [[4, 43], [1, 44]], alignment: [6, 28, 50] },
];

// GF(256) 지수·로그 테이블 (원시다항식 x^8 + x^4 + x^3 + x^2 + 1 = 0x11d)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const lead = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (lead !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], lead);
      }
    }
  }
  return rem;
}

function totalDataCodewords(spec: VersionSpec): number {
  return spec.groups.reduce((sum, [cnt, dc]) => sum + cnt * dc, 0);
}

function charCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

function pickVersion(byteLength: number): VersionSpec {
  for (const spec of VERSION_SPECS) {
    const capacityBits = totalDataCodewords(spec) * 8;
    const neededBits = 4 + charCountBits(spec.version) + byteLength * 8;
    if (neededBits <= capacityBits) return spec;
  }
  throw new Error('QR 코드로 변환할 텍스트가 너무 깁니다.');
}

function encodeDataCodewords(bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const capacityCodewords = totalDataCodewords(spec);
  const capacityBits = capacityCodewords * 8;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Byte mode indicator = 0100
  pushBits(0b0100, 4);
  pushBits(bytes.length, charCountBits(spec.version));
  for (const b of bytes) pushBits(b, 8);

  // Terminator (최대 4비트 0)
  const term = Math.min(4, capacityBits - bits.length);
  pushBits(0, term);
  while (bits.length % 8 !== 0) bits.push(0);

  const out = new Uint8Array(capacityCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    out[i] = byte;
  }
  const pads = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < capacityCodewords; i++, p ^= 1) {
    out[i] = pads[p];
  }
  return out;
}

function interleaveCodewords(data: Uint8Array, spec: VersionSpec): Uint8Array {
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [count, dc] of spec.groups) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + dc);
      offset += dc;
      dataBlocks.push(block);
      ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
    }
  }

  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  const result: number[] = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }
  return Uint8Array.from(result);
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return false;
  }
}

/** Format Info 15비트 계산 (ECC Level M = 00) */
function computeFormatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/** Version Info 18비트 계산 (Version >= 7) */
function computeVersionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}

function drawFormatBits(modules: boolean[][], isFunc: boolean[][], mask: number): void {
  const size = modules.length;
  const bits = computeFormatBits(mask);
  const setMod = (r: number, c: number, dark: boolean) => {
    modules[r][c] = dark;
    isFunc[r][c] = true;
  };

  // 좌상단 파인더 주변
  for (let i = 0; i <= 5; i++) setMod(8, i, ((bits >>> i) & 1) === 1);
  setMod(8, 7, ((bits >>> 6) & 1) === 1);
  setMod(8, 8, ((bits >>> 7) & 1) === 1);
  setMod(7, 8, ((bits >>> 8) & 1) === 1);
  for (let i = 9; i < 15; i++) setMod(14 - i, 8, ((bits >>> i) & 1) === 1);

  // 우상단 및 좌하단 파인더 주변
  for (let i = 0; i < 8; i++) setMod(8, size - 1 - i, ((bits >>> i) & 1) === 1);
  for (let i = 8; i < 15; i++) setMod(size - 15 + i, 8, ((bits >>> i) & 1) === 1);
  setMod(size - 8, 8, true); // Dark module
}

function buildBaseMatrix(spec: VersionSpec): { modules: boolean[][]; isFunc: boolean[][] } {
  const size = spec.version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunc = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunc[r][c] = true;
  };

  // 타이밍 패턴
  for (let i = 0; i < size; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // 파인더 패턴 3곳 + 흰 분리선(separator)
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        setFunc(topR + dr, leftC + dc, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 얼라인먼트 패턴
  const coords = spec.alignment;
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === coords.length - 1) || (i === coords.length - 1 && j === 0)) {
        continue;
      }
      const cr = coords[i];
      const cc = coords[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          setFunc(cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // 버전 정보 (Version >= 7)
  if (spec.version >= 7) {
    const vbits = computeVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // 포맷 정보 영역 예약
  drawFormatBits(modules, isFunc, 0);
  return { modules, isFunc };
}

function placeDataBits(modules: boolean[][], isFunc: boolean[][], codewords: Uint8Array): void {
  const size = modules.length;
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunc[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          modules[r][c] = dark;
        }
      }
    }
  }
}

function penaltyScore(m: boolean[][]): number {
  const n = m.length;
  let score = 0;

  // Rule 1 & 3 (행·열 연속 색상 & 파인더 유사 패턴)
  const finderA = [true, false, true, true, true, false, true, false, false, false, false];
  const finderB = [false, false, false, false, true, false, true, true, true, false, true];

  const scanLine = (get: (i: number) => boolean) => {
    let runColor = get(0);
    let runLen = 1;
    for (let i = 1; i < n; i++) {
      const c = get(i);
      if (c === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = c;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);

    for (let i = 0; i <= n - 11; i++) {
      let matchA = true;
      let matchB = true;
      for (let k = 0; k < 11; k++) {
        const v = get(i + k);
        if (v !== finderA[k]) matchA = false;
        if (v !== finderB[k]) matchB = false;
        if (!matchA && !matchB) break;
      }
      if (matchA || matchB) score += 40;
    }
  };

  for (let r = 0; r < n; r++) scanLine((c) => m[r][c]);
  for (let c = 0; c < n; c++) scanLine((r) => m[r][c]);

  // Rule 2 (2x2 동일 색상 블록)
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 4 (어두운 모듈 비율)
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) dark++;
  const total = n * n;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  if (k > 0) score += k * 10;

  return score;
}

/** 주어진 문자열을 QR 코드 2차원 불리언 행렬(true = 검은 모듈)로 변환합니다. */
export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = pickVersion(bytes.length);
  const dataCw = encodeDataCodewords(bytes, spec);
  const allCw = interleaveCodewords(dataCw, spec);
  const { modules: base, isFunc } = buildBaseMatrix(spec);
  placeDataBits(base, isFunc, allCw);

  let bestMatrix: boolean[][] | null = null;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) =>
      row.map((val, c) => (!isFunc[r][c] && maskBit(mask, r, c) ? !val : val)),
    );
    drawFormatBits(candidate, isFunc, mask);
    const p = penaltyScore(candidate);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMatrix = candidate;
    }
  }
  return bestMatrix!;
}
