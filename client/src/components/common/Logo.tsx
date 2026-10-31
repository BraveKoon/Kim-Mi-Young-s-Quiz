import { Link } from 'react-router-dom';

export function Logo({ size = 'md', to = '/' }: { size?: 'sm' | 'md' | 'lg'; to?: string }) {
  const cls = size === 'lg' ? 'text-4xl md:text-5xl' : size === 'sm' ? 'text-xl' : 'text-2xl';
  return (
    <Link to={to} className={`font-display ${cls} inline-flex items-center gap-2.5 tracking-tight text-white`}>
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span>ClassQuiz</span>
    </Link>
  );
}
