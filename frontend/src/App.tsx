import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './auth/ProtectedRoute'
import { FullPageLoader } from './components/FullPageLoader'
import { lazyNamed } from './lib/lazy'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'

// The role portals (and the charting library) load only for the users who need them.
const StudentLayout = lazyNamed(() => import('./pages/student/StudentLayout'), 'StudentLayout')
const StudentDashboard = lazyNamed(() => import('./pages/student/DashboardPage'), 'DashboardPage')
const StudentAttendance = lazyNamed(() => import('./pages/student/AttendancePage'), 'AttendancePage')
const StudentPerformance = lazyNamed(() => import('./pages/student/PerformancePage'), 'PerformancePage')
const StudentAlerts = lazyNamed(() => import('./pages/student/AlertsPage'), 'AlertsPage')
const StudentAssignments = lazyNamed(() => import('./pages/student/AssignmentsPage'), 'AssignmentsPage')

const FacultyLayout = lazyNamed(() => import('./pages/faculty/FacultyLayout'), 'FacultyLayout')
const FacultyDashboard = lazyNamed(() => import('./pages/faculty/DashboardPage'), 'DashboardPage')
const FacultyAttendance = lazyNamed(() => import('./pages/faculty/AttendancePage'), 'AttendancePage')
const FacultyAssessments = lazyNamed(() => import('./pages/faculty/AssessmentsPage'), 'AssessmentsPage')
const FacultyAssignments = lazyNamed(() => import('./pages/faculty/AssignmentsPage'), 'AssignmentsPage')
const FacultyAssignmentDetail = lazyNamed(() => import('./pages/faculty/AssignmentDetailPage'), 'AssignmentDetailPage')
const FacultyStudents = lazyNamed(() => import('./pages/faculty/StudentsPage'), 'StudentsPage')
const FacultySubjects = lazyNamed(() => import('./pages/faculty/SubjectsPage'), 'SubjectsPage')

const AdminLayout = lazyNamed(() => import('./pages/admin/AdminLayout'), 'AdminLayout')
const AdminOverview = lazyNamed(() => import('./pages/admin/OverviewPage'), 'OverviewPage')
const AdminSubjects = lazyNamed(() => import('./pages/admin/SubjectsPage'), 'SubjectsPage')
const AdminSections = lazyNamed(() => import('./pages/admin/SectionsPage'), 'SectionsPage')
const AdminTeaching = lazyNamed(() => import('./pages/admin/TeachingPage'), 'TeachingPage')
const AdminEnrollments = lazyNamed(() => import('./pages/admin/EnrollmentsPage'), 'EnrollmentsPage')

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="performance" element={<StudentPerformance />} />
            <Route path="alerts" element={<StudentAlerts />} />
            <Route path="assignments" element={<StudentAssignments />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['FACULTY']} />}>
          <Route path="/faculty" element={<FacultyLayout />}>
            <Route index element={<FacultyDashboard />} />
            <Route path="attendance" element={<FacultyAttendance />} />
            <Route path="assessments" element={<FacultyAssessments />} />
            <Route path="assignments" element={<FacultyAssignments />} />
            <Route path="assignments/:assignmentId" element={<FacultyAssignmentDetail />} />
            <Route path="students" element={<FacultyStudents />} />
            <Route path="subjects" element={<FacultySubjects />} />
            <Route path="*" element={<Navigate to="/faculty" replace />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="sections" element={<AdminSections />} />
            <Route path="teaching" element={<AdminTeaching />} />
            <Route path="enrollments" element={<AdminEnrollments />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
