import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-7xl text-slate-300">
        404
      </motion.div>
      <p className="text-lg text-white/70">페이지를 찾을 수 없어요. 학급 주소(예: /2-1)를 다시 확인해 주세요.</p>
      <Link to="/" className="btn-primary">
        <Home className="h-5 w-5" /> 학급 선택으로
      </Link>
    </div>
  );
}
