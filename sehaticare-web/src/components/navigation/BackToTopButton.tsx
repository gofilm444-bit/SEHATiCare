import { useEffect, useState } from 'react';

const SHOW_AFTER_PX = 320;

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  if (!visible) return null;

  const goToTop = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      data-speech-reader-ignore
      onClick={goToTop}
      aria-label="Kembali ke bagian paling atas halaman"
      title="Kembali ke atas"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60] inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-lg transition hover:border-brand hover:text-brand focus:outline-none focus:ring-4 focus:ring-sky-200 motion-reduce:scroll-auto motion-reduce:transition-none md:right-5"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 11 6-6 6 6" />
        <path d="M12 5v14" />
      </svg>
      <span className="hidden sm:inline">Ke atas</span>
    </button>
  );
}
