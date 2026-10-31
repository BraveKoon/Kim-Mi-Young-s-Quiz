/** 테스트에서 시간을 조작할 수 있도록 시계를 주입 가능하게 한다. */
export type Clock = () => number;
export const systemClock: Clock = () => Date.now();
