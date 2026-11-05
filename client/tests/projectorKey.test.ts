import { beforeEach, describe, expect, it } from 'vitest';
import { captureProjectorKey, forgetProjectorKey } from '../src/utils/projector';

describe('프로젝터 컨트롤 키 보관', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/projector/2-1');
  });

  it('주소 해시(#ck=)의 키를 읽어 이 탭에 저장하고 주소에서는 지운다', () => {
    window.history.replaceState(null, '', '/projector/2-1#ck=abc.def.ghi');
    expect(captureProjectorKey('2-1')).toBe('abc.def.ghi');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/projector/2-1');
    // 새로고침처럼 해시가 없어도 같은 탭에서는 키가 유지된다
    expect(captureProjectorKey('2-1')).toBe('abc.def.ghi');
  });

  it('학급별로 따로 보관하며 다른 학급 키는 돌려주지 않는다', () => {
    window.history.replaceState(null, '', '/projector/2-1#ck=key-for-2-1');
    captureProjectorKey('2-1');
    expect(captureProjectorKey('2-2')).toBeNull();
  });

  it('키가 없으면 null 이고, 버린 키는 다시 나오지 않는다', () => {
    expect(captureProjectorKey('2-1')).toBeNull();
    window.history.replaceState(null, '', '/projector/2-1#ck=temp');
    captureProjectorKey('2-1');
    forgetProjectorKey('2-1');
    expect(captureProjectorKey('2-1')).toBeNull();
  });
});
