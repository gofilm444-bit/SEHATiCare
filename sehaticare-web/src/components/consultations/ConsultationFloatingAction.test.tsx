import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ConsultationFloatingAction } from './ConsultationFloatingAction';

vi.mock('../../context/AuthContext',()=>({useAuth:()=>({user:{role:'PASIEN'},token:'test-token',handleUnauthorized:vi.fn()})}));
const response=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
test('floating action is Curhat Ke Konselor when there is no active session and stays above the other floating controls',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(response({items:[]}));render(<MemoryRouter initialEntries={['/patient/education']}><ConsultationFloatingAction/></MemoryRouter>);const button=await screen.findByRole('button',{name:'Curhat Ke Konselor'});expect(button).toHaveClass('min-h-14');expect(button).toHaveClass('bottom-[calc(max(1rem,env(safe-area-inset-bottom))+8.5rem)]')});
test('floating action adapts to an unread reply and is hidden inside conversation detail',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(response({items:[{id:'svc_test',source:'AYO_CURHAT',status:'WAITING_USER',title:'Uji',created_at:'2026-08-05T00:00:00Z',updated_at:'2026-08-05T00:00:00Z',has_unread:true,detail_path:'/patient/consultations/svc_test'}]}));const view=render(<MemoryRouter initialEntries={['/patient/schedules']}><ConsultationFloatingAction/></MemoryRouter>);expect(await screen.findByRole('button',{name:'Buka Balasan'})).toBeInTheDocument();view.unmount();render(<MemoryRouter initialEntries={['/patient/consultations/svc_1234567890abcdef1234567890abcdef']}><ConsultationFloatingAction/></MemoryRouter>);expect(screen.queryByRole('button')).not.toBeInTheDocument()});
