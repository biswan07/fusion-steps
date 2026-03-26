import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SetupScreen } from './components/SetupScreen'
import { isFirebaseConfigured } from './firebase'
import { TeacherLayout } from './layouts/TeacherLayout'
import { StudentLayout } from './layouts/StudentLayout'
import { LoginPage } from './pages/LoginPage'
import { TeacherDashboard } from './pages/teacher/TeacherDashboard'
import { BatchList } from './pages/teacher/BatchList'
import { BatchDetail } from './pages/teacher/BatchDetail'
import { MarkAttendance } from './pages/teacher/MarkAttendance'
import { StudentList } from './pages/teacher/StudentList'
import { StudentProfile } from './pages/teacher/StudentProfile'
import { AssignSubscription } from './pages/teacher/AssignSubscription'
import { VideoList } from './pages/teacher/VideoList'
import { VideoUpload } from './pages/teacher/VideoUpload'
import { StudentHome } from './pages/student/StudentHome'
import { AttendanceHistory } from './pages/student/AttendanceHistory'
import { VideoLibrary } from './pages/student/VideoLibrary'
import { StudentProfilePage } from './pages/student/StudentProfilePage'

export default function App() {
  const authState = useAuthProvider()
  if (!isFirebaseConfigured) return <SetupScreen />
  return (
    <AuthContext.Provider value={authState}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="batches" element={<BatchList />} />
            <Route path="batches/:batchId" element={<BatchDetail />} />
            <Route path="batches/:batchId/attendance" element={<MarkAttendance />} />
            <Route path="students" element={<StudentList />} />
            <Route path="students/:studentId" element={<StudentProfile />} />
            <Route path="students/:studentId/subscribe" element={<AssignSubscription />} />
            <Route path="videos" element={<VideoList />} />
            <Route path="videos/upload" element={<VideoUpload />} />
          </Route>
          <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<StudentHome />} />
            <Route path="attendance" element={<AttendanceHistory />} />
            <Route path="videos" element={<VideoLibrary />} />
            <Route path="profile" element={<StudentProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
