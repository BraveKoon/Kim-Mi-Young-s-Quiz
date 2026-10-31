import confetti from 'canvas-confetti';

export function celebrate(big = false) {
  const end = Date.now() + (big ? 3500 : 1200);
  const colors = ['#ff3dbb', '#22e3ff', '#ffd53d', '#a3ff3d', '#a855f7'];
  const frame = () => {
    confetti({ particleCount: big ? 7 : 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: big ? 7 : 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
  if (big) setTimeout(() => confetti({ particleCount: 180, spread: 120, startVelocity: 45, origin: { y: 0.4 }, colors }), 400);
}
