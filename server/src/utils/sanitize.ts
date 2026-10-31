/**
 * 닉네임 정규화: 앞뒤 공백 제거, 연속 공백 축소, 제어문자 제거.
 * HTML 이스케이프는 하지 않는다 — 클라이언트(React)가 항상 텍스트로 렌더링하며,
 * 서버는 <, > 등 HTML 특수문자를 닉네임에서 허용하지 않는다(검증 단계).
 */
export function normalizeNickname(raw: string): string {
  return raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}
