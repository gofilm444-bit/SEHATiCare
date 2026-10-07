import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { LegacyCounselorRedirect, UnifiedConsultationDetail } from './App';

vi.mock('./context/AuthContext',()=>({useAuth:()=>({token:'test-token',handleUnauthorized:vi.fn(),user:{role:'PASIEN'},isAuthenticated:true})}));

function Location(){const location=useLocation();return <output aria-label="current-path">{location.pathname}</output>}
test('legacy counselor detail redirects deterministically and preserves the public session id',async()=>{render(<MemoryRouter initialEntries={['/patient/counselor/svc_1234567890abcdef1234567890abcdef']}><Routes><Route path="/patient/counselor/:id" element={<LegacyCounselorRedirect/>}/><Route path="*" element={<Location/>}/></Routes></MemoryRouter>);expect(await screen.findByLabelText('current-path')).toHaveTextContent('/patient/consultations/svc_1234567890abcdef1234567890abcdef')});
test('unified detail uses the same consultation adapter for modern service ids',()=>{render(<MemoryRouter initialEntries={['/patient/consultations/svc_1234567890abcdef1234567890abcdef']}><Routes><Route path="/patient/consultations/:id" element={<UnifiedConsultationDetail/>}/></Routes></MemoryRouter>);expect(screen.getByRole('status')).toHaveTextContent(/Memuat konsultasi/i)});
