import type { SVGProps } from 'react';

export type IconName = 'home'|'chat'|'calendar'|'bell'|'book'|'building'|'help'|'settings'|'user'|'users'|'clipboard'|'shield'|'activity'|'menu'|'close'|'chevron'|'logout'|'heart'|'clock'|'check';
const paths: Record<IconName, JSX.Element> = {
  home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6"/></>,
  chat:<><path d="M20 15a4 4 0 0 1-4 4H8l-5 2 1.5-4A8 8 0 1 1 20 15Z"/><path d="M8 11h8M8 15h5"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>, bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  book:<><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23Z"/></>,
  building:<><path d="M4 21V5l8-3 8 3v16M8 8h1M8 12h1M8 16h1M15 8h1M15 12h1M15 16h1M9 21v-3h6v3"/></>,
  help:<><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.2.9-1.2 1.7M12 17h.01"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19 15a2 2 0 0 0 .4 2l-2.8 2.8a2 2 0 0 0-2-.4 2 2 0 0 0-1.2 1.8h-4a2 2 0 0 0-1.2-1.8 2 2 0 0 0-2 .4L3.4 17a2 2 0 0 0 .4-2A2 2 0 0 0 2 13.8v-4A2 2 0 0 0 3.8 8a2 2 0 0 0-.4-2l2.8-2.8a2 2 0 0 0 2 .4A2 2 0 0 0 9.4 2h4a2 2 0 0 0 1.2 1.8 2 2 0 0 0 2-.4L19.4 6a2 2 0 0 0-.4 2 2 2 0 0 0 1.8 1.2v4A2 2 0 0 0 19 15Z"/></>,
  user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  clipboard:<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/></>, shield:<><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>, activity:<path d="M3 12h4l2-7 4 14 2-7h6"/>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>, close:<path d="m6 6 12 12M18 6 6 18"/>, chevron:<path d="m9 18 6-6-6-6"/>, logout:<path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>,
  heart:<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>, clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, check:<path d="m5 12 4 4L19 6"/>
};
export function Icon({name,className='h-5 w-5',...props}:{name:IconName}&SVGProps<SVGSVGElement>){return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>{paths[name]}</svg>}
