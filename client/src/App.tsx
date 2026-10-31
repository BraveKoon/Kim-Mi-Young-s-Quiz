import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { FullScreenSpinner } from './components/common/Spinner';
import ClassPage from './pages/ClassPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// 관리자·프로젝터·결과 화면은 차트 라이브러리 등으로 무거우므로 필요할 때만 불러온다.
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ProjectorPage = lazy(() => import('./pages/ProjectorPage'));
const CompetitionProjectorPage = lazy(() => import('./pages/ProjectorPage').then((m) => ({ default: m.CompetitionProjectorPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/dashboard/:section" element={<AdminDashboard />} />
        <Route path="/projector/competition/:competitionId" element={<CompetitionProjectorPage />} />
        <Route path="/projector/:classId" element={<ProjectorPage />} />
        <Route path="/results/:competitionId" element={<ResultsPage />} />
        <Route path="/:classId" element={<ClassPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
