import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { consultationApi, ConsultationOverviewItem } from '../../api/consultations';
import { useAuth } from '../../context/AuthContext';

const openStatuses=new Set(['QUEUED','ASSIGNED','ACTIVE','WAITING_USER','WAITING_COUNSELOR','ESCALATED']);

function actionFor(items:ConsultationOverviewItem[]){
  const session=items.find(item=>openStatuses.has(item.status));
  if(!session)return{label:'Curhat Ke Konselor',path:'/patient/consultations?start=1'};
  if(session.has_unread)return{label:'Buka Balasan',path:session.detail_path};
  if(['QUEUED','ESCALATED'].includes(session.status))return{label:'Lihat Status Curhat',path:session.detail_path};
  return{label:'Lanjutkan Curhat',path:session.detail_path};
}

export function ConsultationFloatingAction(){
  const {user,token,handleUnauthorized}=useAuth();const location=useLocation();const navigate=useNavigate();const[items,setItems]=useState<ConsultationOverviewItem[]>([]);
  const auth=useMemo(()=>({token,onUnauthorized:handleUnauthorized}),[handleUnauthorized,token]);
  useEffect(()=>{if(user?.role!=='PASIEN')return;void consultationApi.overview(auth).then(result=>setItems(result.items)).catch(()=>undefined)},[auth,location.pathname,user?.role]);
  if(user?.role!=='PASIEN'||/^\/patient\/consultations\/(?:svc_|legacy\/|[0-9a-f-]{20,})/i.test(location.pathname))return null;
  const action=actionFor(items);
  return <button type="button" onClick={()=>navigate(action.path)} aria-label={action.label} className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+8.5rem)] right-4 z-[70] inline-flex min-h-14 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-empathy px-5 py-3 font-semibold text-white shadow-xl transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 motion-reduce:transition-none md:right-5">
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.5-4A9 9 0 1 1 21 12Z"/></svg><span>{action.label}</span>
  </button>;
}
