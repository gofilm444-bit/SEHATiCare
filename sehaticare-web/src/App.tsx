import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminPortalPage } from './pages/admin/AdminPortalPage';
import { AdminEducationPage } from './pages/admin/AdminEducationPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminMonitoringPage } from './pages/admin/AdminMonitoringPage';
import { PublicLandingPage } from './pages/public/PublicLandingPage';
import { PublicEducationPage } from './pages/public/PublicEducationPage';
import { DoctorQueuePage } from './pages/doctor/DoctorQueuePage';
import { PatientDashboard } from './pages/PatientDashboard';
import { PatientConsultationDetail } from './pages/patient/PatientConsultationDetail';
import { PatientConsultationHistory } from './pages/patient/PatientConsultationHistory';
import { DoctorConsultationDetail } from './pages/doctor/DoctorConsultationDetail';
import { DoctorConsultationHistory } from './pages/doctor/DoctorConsultationHistory';
import { PatientEducationDetail } from './pages/PatientEducationDetail';
import { PatientEducationList } from './pages/PatientEducationList';
import { PendampingDashboard } from './pages/pendamping/PendampingDashboard';
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
      <Route path="/" element={<PublicLandingPage />} />
      <Route path="/edukasi" element={<PublicEducationPage />} />
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
          <Route path="/admin/portal" element={<AdminPortalPage />} />
          <Route path="/admin/education" element={<AdminEducationPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
          <Route path="/admin/monitoring" element={<AdminMonitoringPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['PENDAMPING']} />}>
        <Route element={<AppShell />}>
          <Route path="/pendamping" element={<PendampingDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
