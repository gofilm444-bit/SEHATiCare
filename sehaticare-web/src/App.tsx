import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { DoctorQueuePage } from './pages/doctor/DoctorQueuePage';
import { PatientDashboard } from './pages/PatientDashboard';
import { PatientConsultationDetail } from './pages/patient/PatientConsultationDetail';
import { PatientConsultationHistory } from './pages/patient/PatientConsultationHistory';
import { DoctorConsultationDetail } from './pages/doctor/DoctorConsultationDetail';
import { DoctorConsultationHistory } from './pages/doctor/DoctorConsultationHistory';
import { PatientEducationDetail } from './pages/PatientEducationDetail';
import { PatientEducationList } from './pages/PatientEducationList';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { getDashboardPath } from './lib/roles';

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute allowedRoles={['PASIEN']} />}>
        <Route element={<AppShell />}>
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/patient/consultations" element={<PatientConsultationHistory />} />
          <Route path="/patient/consultations/:id" element={<PatientConsultationDetail />} />
          <Route path="/patient/education" element={<PatientEducationList />} />
          <Route path="/patient/education/:id" element={<PatientEducationDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['DOKTER']} />}>
        <Route element={<AppShell />}>
          <Route path="/doctor" element={<DoctorQueuePage />} />
          <Route path="/doctor/history" element={<DoctorConsultationHistory />} />
          <Route path="/doctor/consultations/:id" element={<DoctorConsultationDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
