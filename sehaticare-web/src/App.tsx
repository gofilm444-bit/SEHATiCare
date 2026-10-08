import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminPortalPage } from './pages/admin/AdminPortalPage';
import { AdminEducationPage } from './pages/admin/AdminEducationPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminMonitoringPage } from './pages/admin/AdminMonitoringPage';
import { PublicLandingPage } from './pages/public/PublicLandingPage';
import { DoctorQueuePage } from './pages/doctor/DoctorQueuePage';
import { PatientDashboard } from './pages/PatientDashboard';
import { DoctorConsultationDetail } from './pages/doctor/DoctorConsultationDetail';
import { DoctorConsultationHistory } from './pages/doctor/DoctorConsultationHistory';
import { PatientEducationDetail } from './pages/PatientEducationDetail';
import { PatientEducationList } from './pages/PatientEducationList';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PrivacyProvider } from './context/PrivacyContext';
import { useAuth } from './context/AuthContext';
import { getDashboardPath } from './lib/roles';
import { TextToSpeechReader } from './components/accessibility/TextToSpeechReader';
import { AnonymousRegistrationPage } from './pages/AnonymousRegistrationPage';
import { AnonymousRecoveryPage } from './pages/AnonymousRecoveryPage';
import { AccountProfilePage } from './pages/AccountProfilePage';
import { PublicInformationPage } from './pages/public/PublicInformationPage';
import { PublicContentPage } from './pages/public/PublicContentPage';
import { AdherenceHistoryPage, ControlSchedulesPage, MedicationRemindersPage, NotificationPreferencesPage } from './pages/healthPlanning/HealthPlanningPages';
import { MedicationReminderEditPage } from './pages/healthPlanning/MedicationReminderEditPage';
import { MedicationSectionLayout } from './components/healthPlanning/MedicationNavigation';
import { CounselorConversationPage, CounselorQueuePage } from './pages/stage4/CounselorPages';
import { ComplaintDetailPage, ComplaintOfficerQueuePage, ComplaintTrackingPage, PatientComplaintListPage, PublicComplaintPage } from './pages/stage4/ComplaintPages';
import { UnifiedConsultationsPage } from './pages/patient/UnifiedConsultationsPage';
import { MobileInstallPrompt } from './components/pwa/MobileInstallPrompt';
import { BackToTopButton } from './components/navigation/BackToTopButton';
import { UnifiedConsultationDetailPage } from './pages/patient/UnifiedConsultationDetailPage';
import { CounselorApplicationPage, CounselorRegistrationPage } from './pages/stage4/CounselorApplicationPages';
import { AdminCounselorPage } from './pages/admin/AdminCounselorPage';
import { ConversationReportReviewPage } from './pages/admin/ConversationReportReviewPage';
import { ComplaintReassignmentPage } from './pages/stage4/ComplaintReassignmentPage';
import { AdminProfessionalAssignmentsPage, CompanionAssignmentsPage, OutreachCasesPage } from './pages/stage4/ProfessionalRolePages';
import { PatientCareMonitoringPage } from './pages/patient/PatientCareMonitoringPage';

export function UnifiedConsultationDetail() {
  return <UnifiedConsultationDetailPage />;
}

export function LegacyCounselorRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/patient/consultations/${encodeURIComponent(id)}`} replace />;
}

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <PrivacyProvider>
      <Routes>
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/edukasi" element={<PublicContentPage />} />
        <Route path="/edukasi/:slug" element={<PublicContentPage />} />
        <Route path="/edukasi/video/:videoId" element={<PublicContentPage />} />
        <Route path="/informasi-layanan" element={<PublicInformationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<AnonymousRegistrationPage />} />
        <Route path="/register-counselor" element={<CounselorRegistrationPage />} />
        <Route path="/recover-account" element={<AnonymousRecoveryPage />} />
        <Route path="/complaints/new" element={<PublicComplaintPage />} />
        <Route path="/complaints/track" element={<ComplaintTrackingPage />} />

        <Route element={<ProtectedRoute allowedRoles={['PASIEN', 'DOKTER', 'ADMIN', 'COUNSELOR', 'COMPLAINT_OFFICER', 'SUPERVISOR']} />}>
          <Route element={<AppShell />}><Route path="/account" element={<AccountProfilePage />} /></Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['PASIEN']} />}>
          <Route element={<AppShell />}>
            <Route path="/patient" element={<PatientDashboard />} />
            <Route path="/patient/care" element={<PatientCareMonitoringPage />} />
            <Route path="/patient/consultations" element={<UnifiedConsultationsPage />} />
            <Route path="/patient/consultations/legacy/:id" element={<LegacyCounselorRedirect />} />
            <Route path="/patient/consultations/:id" element={<UnifiedConsultationDetail />} />
            <Route path="/patient/education" element={<PatientEducationList />} />
            <Route path="/patient/education/:id" element={<PatientEducationDetail />} />
            <Route path="/patient/schedules" element={<ControlSchedulesPage />} />
            <Route element={<MedicationSectionLayout />}>
              <Route path="/patient/medication-reminders" element={<MedicationRemindersPage />} />
              <Route path="/patient/medication-reminders/edit" element={<MedicationReminderEditPage />} />
              <Route path="/patient/adherence" element={<AdherenceHistoryPage />} />
            </Route>
            <Route path="/patient/notification-preferences" element={<NotificationPreferencesPage />} />
            <Route path="/patient/counselor" element={<Navigate to="/patient/consultations" replace />} />
            <Route path="/patient/counselor/:id" element={<LegacyCounselorRedirect />} />
            <Route path="/patient/chat" element={<Navigate to="/patient/consultations" replace />} />
            <Route path="/patient/consultation-history" element={<Navigate to="/patient/consultations" replace />} />
            <Route path="/patient/complaints" element={<PatientComplaintListPage />} />
            <Route path="/patient/complaints/:id" element={<ComplaintDetailPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['DOKTER']} />}>
          <Route element={<AppShell />}>
            <Route path="/doctor" element={<DoctorQueuePage />} />
            <Route path="/doctor/history" element={<DoctorConsultationHistory />} />
            <Route path="/doctor/consultations/:id" element={<DoctorConsultationDetail />} />
            <Route path="/doctor/schedules" element={<ControlSchedulesPage />} />
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
            <Route path="/admin/counselors" element={<AdminCounselorPage />} />
            <Route path="/admin/professional-assignments" element={<AdminProfessionalAssignmentsPage />} />
            <Route path="/admin/conversation-reports" element={<ConversationReportReviewPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['DOKTER', 'COUNSELOR']} />}>
          <Route element={<AppShell />}>
            <Route path="/counselor-application" element={<CounselorApplicationPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['COUNSELOR', 'DOKTER']} />}>
          <Route element={<AppShell />}>
            <Route path="/counselor" element={<CounselorQueuePage />} />
            <Route path="/counselor/conversations/:id" element={<CounselorConversationPage staff />} />
            <Route path="/companion" element={<CompanionAssignmentsPage />} />
            <Route path="/companion/conversations/:id" element={<CounselorConversationPage staff canClose={false} />} />
            <Route path="/outreach" element={<OutreachCasesPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['COMPLAINT_OFFICER', 'SUPERVISOR']} />}>
          <Route element={<AppShell />}>
            <Route path="/complaint-officer" element={<ComplaintOfficerQueuePage />} />
            <Route path="/complaint-officer/:id" element={<ComplaintDetailPage staff />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR']} />}>
          <Route element={<AppShell />}>
            <Route path="/supervisor/conversation-reports" element={<ConversationReportReviewPage />} />
            <Route path="/supervisor/complaint-reassignment" element={<ComplaintReassignmentPage />} />
          </Route>
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      <TextToSpeechReader />
      <BackToTopButton />
      <MobileInstallPrompt />
    </PrivacyProvider>
  );
}
