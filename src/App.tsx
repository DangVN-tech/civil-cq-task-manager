import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { useAuth } from './context/AuthContext'
import { canManageStaff, canManageStorage, canViewDashboard } from './lib/permissions'
import CompletedPage from './pages/CompletedPage'
import DashboardPage from './pages/DashboardPage'
import InProgressPage from './pages/InProgressPage'
import LoginPage from './pages/LoginPage'
import SearchPage from './pages/SearchPage'
import StaffPage from './pages/StaffPage'
import StoragePage from './pages/StoragePage'
import { Loading } from './components/ui'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <Loading label="Đang khởi động..." />
  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dang-thuc-hien" replace />} />
        <Route path="/dang-thuc-hien" element={<InProgressPage />} />
        <Route path="/hoan-thanh" element={<CompletedPage />} />
        <Route path="/tim-kiem" element={<SearchPage />} />
        <Route
          path="/dashboard"
          element={canViewDashboard(user) ? <DashboardPage /> : <Navigate to="/dang-thuc-hien" replace />}
        />
        <Route
          path="/nhan-su"
          element={canManageStaff(user) ? <StaffPage /> : <Navigate to="/dang-thuc-hien" replace />}
        />
        <Route
          path="/dung-luong"
          element={canManageStorage(user) ? <StoragePage /> : <Navigate to="/dang-thuc-hien" replace />}
        />
        <Route path="*" element={<Navigate to="/dang-thuc-hien" replace />} />
      </Route>
    </Routes>
  )
}
