import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function Logo({ size = 'md', to = '/' }: { size?: 'sm' | 'md' | 'lg'; to?: string }) {
  const cls = size === 'lg' ? 'text-5xl md:text-7xl' : size === 'sm' ? 'text-xl' : 'text-3xl';
  return (
    <Link to={to} className={`font-display ${cls} inline-flex items-center gap-2 tracking-wide`}>
      <Sparkles className="h-[0.8em] w-[0.8em] text-neon-yellow" />
      <span className="bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-200 bg-clip-text text-transparent neon-text">ClassQuiz</span>
    </Link>
  );
}
