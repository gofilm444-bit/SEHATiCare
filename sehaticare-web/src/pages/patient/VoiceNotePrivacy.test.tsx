import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PatientConsultationDetail } from './PatientConsultationDetail';
import { DoctorConsultationDetail } from '../doctor/DoctorConsultationDetail';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { role: 'PASIEN' },
    handleUnauthorized: vi.fn(),
    isAuthenticated: true
  })
}));

describe('Voice note storage privacy hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test('patient consultation detail removes legacy voice note storage and never writes to localStorage', async () => {
    const consultationId = 'cons-patient-privacy-123';
    localStorage.setItem(`sehaticare.voiceNotes.${consultationId}`, JSON.stringify({ pending: [{ id: 'vn-old', sentAt: 1000 }], resolved: {} }));

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes(`/consultations/${consultationId}/messages`)) {
        return new Response(JSON.stringify({
          messages: [
            {
              id: 'msg-vn-1',
              sender_role: 'PASIEN',
              content: '[VOICE_NOTE]',
              voice_note_id: 'vn-server-id-1',
              created_at: new Date().toISOString()
            }
          ],
          ai_typing: false
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes(`/consultations/${consultationId}`)) {
        return new Response(JSON.stringify({
          id: consultationId,
          status: 'MENUNGGU_DOKTER',
          initial_complaint: 'Keluhan uji privasi voice note',
          opened_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          consent_at: new Date().toISOString(),
          consent_version: '2026-v1'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter initialEntries={[`/patient/consultations/${consultationId}`]}>
        <Routes>
          <Route path="/patient/consultations/:id" element={<PatientConsultationDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(localStorage.getItem(`sehaticare.voiceNotes.${consultationId}`)).toBeNull();
    });

    expect(JSON.stringify(localStorage)).not.toContain('vn-old');
    expect(JSON.stringify(localStorage)).not.toContain('sehaticare.voiceNotes');
    expect(JSON.stringify(sessionStorage)).not.toContain('sehaticare.voiceNotes');
  });

  test('doctor consultation detail removes legacy voice note storage and keeps storage clean', async () => {
    const consultationId = 'cons-doctor-privacy-456';
    localStorage.setItem(`sehaticare.voiceNotes.${consultationId}`, JSON.stringify({ pending: [{ id: 'vn-doc-old', sentAt: 1000 }], resolved: {} }));

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes(`/consultations/${consultationId}/messages`)) {
        return new Response(JSON.stringify({
          messages: [
            {
              id: 'msg-vn-doc-1',
              sender_role: 'DOKTER',
              content: '[VOICE_NOTE]',
              voice_note_id: 'vn-server-doc-1',
              created_at: new Date().toISOString()
            }
          ],
          ai_typing: false
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes(`/consultations/${consultationId}`)) {
        return new Response(JSON.stringify({
          id: consultationId,
          status: 'DOKTER_AKTIF',
          initial_complaint: 'Keluhan uji dokter privasi',
          opened_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          consent_at: new Date().toISOString(),
          consent_version: '2026-v1'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    render(
      <MemoryRouter initialEntries={[`/doctor/consultations/${consultationId}`]}>
        <Routes>
          <Route path="/doctor/consultations/:id" element={<DoctorConsultationDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(localStorage.getItem(`sehaticare.voiceNotes.${consultationId}`)).toBeNull();
    });

    expect(JSON.stringify(localStorage)).not.toContain('vn-doc-old');
    expect(JSON.stringify(localStorage)).not.toContain('sehaticare.voiceNotes');
    expect(JSON.stringify(sessionStorage)).not.toContain('sehaticare.voiceNotes');
  });
});
