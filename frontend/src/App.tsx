import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './auth/ProtectedRoute'
import { FullPageLoader } from './components/FullPageLoader'
import { AdminHome } from './pages/AdminHome'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'

// The role portals (and the charting library) load only for the users who need them.
const StudentLayout = lazy(() => import('./pages/student/StudentLayout').then((m) => ({ default: m.StudentLayout })))
const StudentDashboardPage = lazy(() =>
  import('./pages/student/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const StudentAttendancePage = lazy(() =>
  import('./pages/student/AttendancePage').then((m) => ({ default: m.AttendancePage })),
)
const StudentPerformancePage = lazy(() =>
  import('./pages/student/PerformancePage').then((m) => ({ default: m.PerformancePage })),
)
const StudentAlertsPage = lazy(() => import('./pages/student/AlertsPage').then((m) => ({ default: m.AlertsPage })))

const FacultyLayout = lazy(() => import('./pages/faculty/FacultyLayout').then((m) => ({ default: m.FacultyLayout })))
const DashboardPage = lazy(() => import('./pages/faculty/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AttendancePage = lazy(() =>
  import('./pages/faculty/AttendancePage').then((m) => ({ default: m.AttendancePage })),
)
const AssessmentsPage = lazy(() =>
  import('./pages/faculty/AssessmentsPage').then((m) => ({ default: m.AssessmentsPage })),
)
const StudentsPage = lazy(() => import('./pages/faculty/StudentsPage').then((m) => ({ default: m.StudentsPage })))
const SubjectsPage = lazy(() => import('./pages/faculty/SubjectsPage').then((m) => ({ default: m.SubjectsPage })))

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboardPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="performance" element={<StudentPerformancePage />} />
            <Route path="alerts" element={<StudentAlertsPage />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['FACULTY']} />}>
          <Route path="/faculty" element={<FacultyLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="assessments" element={<AssessmentsPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="*" element={<Navigate to="/faculty" replace />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin/*" element={<AdminHome />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
