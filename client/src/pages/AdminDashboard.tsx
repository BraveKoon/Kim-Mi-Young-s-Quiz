import {
  BarChart3,
  ClipboardList,
  Download,
  FileQuestion,
  Gauge,
  History,
  Layers,
  LogOut,
  Medal,
  PlayCircle,
  School,
  Settings,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ClassroomAccentStrip, Logo } from '../components/common/Logo';
import { FullScreenSpinner } from '../components/common/Spinner';
import { AnalyticsSection } from '../components/dashboard/sections/AnalyticsSection';
import { ClassesSection } from '../components/dashboard/sections/ClassesSection';
import { CompetitionsSection } from '../components/dashboard/sections/CompetitionsSection';
import { ExportsSection } from '../components/dashboard/sections/ExportsSection';
import { LogsSection } from '../components/dashboard/sections/LogsSection';
import { OverviewSection } from '../components/dashboard/sections/OverviewSection';
import { QuestionsSection } from '../components/dashboard/sections/QuestionsSection';
import { QuizControlSection } from '../components/dashboard/sections/QuizControlSection';
import { QuizSetsSection } from '../components/dashboard/sections/QuizSetsSection';
import { ClassRankingSection, IndividualRankingSection } from '../components/dashboard/sections/RankingSections';
import { ChangePasswordForm, SettingsSection } from '../components/dashboard/sections/SettingsSection';
import { StudentsSection } from '../components/dashboard/sections/StudentsSection';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminSocketProvider, useAdminSocket } from '../contexts/AdminSocketContext';

export const MENUS = [
  { key: 'overview', label: '대시보드', icon: Gauge, el: OverviewSection },
  { key: 'classes', label: '학급 관리', icon: School, el: ClassesSection },
  { key: 'students', label: '학생 관리', icon: Users, el: StudentsSection },
  { key: 'questions', label: '문제 관리', icon: FileQuestion, el: QuestionsSection },
  { key: 'quiz-sets', label: '문제 세트 관리', icon: Layers, el: QuizSetsSection },
  { key: 'control', label: '퀴즈 진행 관리', icon: PlayCircle, el: QuizControlSection },
  { key: 'individual-ranking', label: '개인 순위', icon: Medal, el: IndividualRankingSection },
  { key: 'class-ranking', label: '학급 순위', icon: Trophy, el: ClassRankingSection },
  { key: 'analytics', label: '문항별 통계', icon: BarChart3, el: AnalyticsSection },
  { key: 'logs', label: '활동 로그', icon: ClipboardList, el: LogsSection },
  { key: 'competitions', label: '대회 이력', icon: History, el: CompetitionsSection },
  { key: 'exports', label: '결과 내보내기', icon: Download, el: ExportsSection },
  { key: 'settings', label: '설정', icon: Settings, el: SettingsSection },
] as const;

export default function AdminDashboard() {
  const { admin, token, loading, logout } = useAdminAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !admin) nav('/admin', { replace: true });
  }, [admin, loading, nav]);

  if (loading || !admin || !token) return <FullScreenSpinner />;

  if (admin.mustChangePassword) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="glass-strong w-full max-w-md overflow-hidden">
          <ClassroomAccentStrip />
          <div className="space-y-4 p-7 sm:p-8">
            <Logo size="sm" />
            <h1 className="font-display text-2xl text-slate-900">초기 비밀번호 변경</h1>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-900">
              보안을 위해 초기 비밀번호를 변경해야 관리자 기능을 사용할 수 있습니다.
            </p>
            <ChangePasswordForm />
            <button className="btn-ghost w-full" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminSocketProvider token={token}>
      <DashboardLayout />
    </AdminSocketProvider>
  );
}

function DashboardLayout() {
  const { section = 'overview' } = useParams();
  const { admin, logout } = useAdminAuth();
  const { connected, overview } = useAdminSocket();
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);
  const menu = MENUS.find((m) => m.key === section) ?? MENUS[0];
  const Section = menu.el;

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [menu.key]);

  return (
    <div className="flex min-h-dvh w-full max-w-full flex-col overflow-x-clip lg:flex-row">
      <aside className="glass m-2 flex min-w-0 shrink-0 flex-col overflow-hidden rounded-3xl lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)] lg:w-64">
        <ClassroomAccentStrip />
        <div className="flex flex-1 flex-col gap-1 overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between px-2 pt-1 lg:mb-3">
            <Logo size="sm" to="/admin/dashboard" />
            <div className="flex items-center gap-3 text-xs text-slate-600 lg:hidden">
              {connected ? <Wifi className="h-4 w-4 text-teal-600" /> : <WifiOff className="h-4 w-4 text-rose-500" />}
              <button className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900" onClick={logout}>
                <LogOut className="h-4 w-4" /> 로그아웃
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto lg:pb-0">
            {MENUS.map((m) => {
              const isActive = m.key === menu.key;
              return (
                <NavLink
                  key={m.key}
                  ref={isActive ? activeTabRef : undefined}
                  to={`/admin/dashboard/${m.key}`}
                  className={() =>
                    `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_-3px_rgba(37,99,235,0.4)]'
                        : 'text-slate-600 hover:bg-sky-50 hover:text-slate-900'
                    }`
                  }
                >
                  <m.icon className="h-4 w-4" /> {m.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto hidden space-y-2 border-t border-slate-200/90 pt-3 text-xs text-slate-600 lg:block">
            <div className="flex items-center gap-1.5 font-semibold">
              {connected ? <Wifi className="h-4 w-4 text-teal-600" /> : <WifiOff className="h-4 w-4 text-rose-500" />}
              <span>실시간 연결 {connected ? '정상' : '끊김'}</span>
            </div>
            {overview && (
              <div className="rounded-xl border border-sky-100 bg-[#F3F9FF] px-3 py-2 font-semibold text-slate-700">
                전체 접속 <b className="text-[#1D4ED8]">{overview.totals.connected}</b>/{overview.totals.capacity}명
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-slate-800">{admin?.username}</span>
              <button className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900" onClick={logout}>
                <LogOut className="h-4 w-4" /> 로그아웃
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 max-w-full flex-1 p-3 md:p-6">
        <Section />
      </main>
    </div>
  );
}
