import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminHome } from './pages/AdminHome'
import { FacultyHome } from './pages/FacultyHome'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { StudentHome } from './pages/StudentHome'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
        <Route path="/student/*" element={<StudentHome />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['FACULTY']} />}>
        <Route path="/faculty/*" element={<FacultyHome />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route path="/admin/*" element={<AdminHome />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
