/** 마우스·키보드 기기(데스크톱)에서만 자동 포커스한다. 터치 기기에서는 키보드가 갑자기 올라오는 것을 막는다. */
export const autoFocusOnDesktop: boolean =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
