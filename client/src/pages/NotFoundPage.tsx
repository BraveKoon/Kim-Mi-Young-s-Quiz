import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo size="lg" />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="glass-strong w-full max-w-md overflow-hidden"
      >
        <div className="space-y-4 p-8">
          <div className="font-display text-7xl text-brand-600">404</div>
          <p className="text-base font-medium text-slate-600">페이지를 찾을 수 없어요. 학급 주소(예: /2-1)를 다시 확인해 주세요.</p>
          <Link to="/" className="btn-primary w-full">
            <Home className="h-5 w-5" /> 처음 화면으로
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
