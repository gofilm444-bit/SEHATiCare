import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/icons';

const STORAGE_KEY = 'sehaticare:text-reader-enabled';
const HOVER_DELAY_MS = 450;
const MAX_SPEECH_LENGTH = 700;

const readableSelector = [
  '[data-speech-text]',
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'dt',
  'dd',
  'th',
  'td',
  'img',
  '[role="button"]',
  '[role="link"]',
  '[aria-label]',
  '[title]'
].join(',');

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function getReadableText(element: HTMLElement) {
  const customText = normalizeText(element.dataset.speechText);
  if (customText) return customText;

  const ariaLabel = normalizeText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const label = element.labels?.[0] ? normalizeText(element.labels[0].innerText) : '';
    const value = normalizeText(element.value);
    const placeholder = normalizeText(element.placeholder);
    return [label, value || placeholder].filter(Boolean).join('. ');
  }

  if (element instanceof HTMLSelectElement) {
    const label = element.labels?.[0] ? normalizeText(element.labels[0].innerText) : '';
    const selectedValue = normalizeText(element.selectedOptions[0]?.text);
    return [label, selectedValue].filter(Boolean).join('. ');
  }

  if (element instanceof HTMLImageElement) {
    return normalizeText(element.alt || element.title);
  }

  const text = normalizeText(element.innerText || element.textContent);
  return text || normalizeText(element.title);
}

function findReadableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;
  if (target.closest('[data-speech-reader-ignore]')) return null;

  const semanticElement = target.closest<HTMLElement>(readableSelector);
  if (semanticElement && !semanticElement.closest('[aria-hidden="true"]')) {
    return semanticElement;
  }

  // Some dashboard labels use a plain span/div. Read the nearest concise block
  // instead of an entire card or page section.
  let candidate: HTMLElement | null = target;
  for (let depth = 0; candidate && depth < 3; depth += 1) {
    const text = getReadableText(candidate);
    if (text && text.length <= MAX_SPEECH_LENGTH) return candidate;
    candidate = candidate.parentElement;
  }

  return null;
}

export function TextToSpeechReader() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [supported] = useState(() => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  const [status, setStatus] = useState('Pembaca teks tidak aktif');
  const hoverTimer = useRef<number | null>(null);
  const lastElement = useRef<HTMLElement | null>(null);
  const highlightedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // The reader still works when browser storage is unavailable.
    }

    setStatus(enabled ? 'Pembaca teks aktif' : 'Pembaca teks tidak aktif');
    if (!enabled && supported) window.speechSynthesis.cancel();
  }, [enabled, supported]);

  useEffect(() => {
    if (!supported) return;

    const clearHighlight = () => {
      highlightedElement.current?.removeAttribute('data-speech-reader-active');
      highlightedElement.current = null;
    };

    const speak = (element: HTMLElement) => {
      const text = getReadableText(element).slice(0, MAX_SPEECH_LENGTH);
      if (!text) return;

      clearHighlight();
      element.setAttribute('data-speech-reader-active', 'true');
      highlightedElement.current = element;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      const indonesianVoice = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith('id'));
      if (indonesianVoice) utterance.voice = indonesianVoice;
      utterance.addEventListener('end', clearHighlight, { once: true });
      utterance.addEventListener('error', clearHighlight, { once: true });
      window.speechSynthesis.speak(utterance);
    };

    const queueSpeech = (event: MouseEvent) => {
      if (!enabled) return;
      const element = findReadableElement(event.target);
      if (!element || element === lastElement.current) return;

      lastElement.current = element;
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => speak(element), HOVER_DELAY_MS);
    };

    const speakFocusedElement = (event: FocusEvent) => {
      if (!enabled) return;
      const element = findReadableElement(event.target);
      if (!element) return;
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      lastElement.current = element;
      speak(element);
    };

    const resetHoveredElement = (event: MouseEvent) => {
      const nextElement = event.relatedTarget instanceof HTMLElement
        ? findReadableElement(event.relatedTarget)
        : null;
      if (nextElement !== lastElement.current) lastElement.current = null;
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setEnabled((current) => !current);
      }
      if (event.key === 'Escape') {
        window.speechSynthesis.cancel();
        clearHighlight();
      }
    };

    document.addEventListener('mouseover', queueSpeech);
    document.addEventListener('mouseout', resetHoveredElement);
    document.addEventListener('focusin', speakFocusedElement);
    document.addEventListener('keydown', handleShortcut);

    return () => {
      document.removeEventListener('mouseover', queueSpeech);
      document.removeEventListener('mouseout', resetHoveredElement);
      document.removeEventListener('focusin', speakFocusedElement);
      document.removeEventListener('keydown', handleShortcut);
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      window.speechSynthesis.cancel();
      clearHighlight();
    };
  }, [enabled, supported]);

  if (!supported) return null;

  return (
    <div
      data-speech-reader-ignore
      className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] right-4 z-[60] max-w-[calc(100vw-2rem)] md:right-5"
    >
      <button
        type="button"
        aria-pressed={enabled}
        aria-describedby="text-reader-help"
        onClick={() => setEnabled((current) => !current)}
        className={`flex min-h-12 items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold shadow-lg transition focus:outline-none focus:ring-4 focus:ring-sky-200 ${
          enabled
            ? 'border-sky-700 bg-sky-700 text-white hover:bg-sky-800'
            : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
        }`}
      >
        <Icon name={enabled ? 'activity' : 'book'} className="h-5 w-5" />
        <span className="hidden min-[390px]:inline">Pembaca teks: {enabled ? 'Aktif' : 'Mati'}</span>
        <span className="min-[390px]:hidden">Teks: {enabled ? 'Aktif' : 'Mati'}</span>
      </button>
      <span id="text-reader-help" className="sr-only">
        Aktifkan untuk membacakan teks saat diarahkan kursor atau menerima fokus. Pintasan Alt dan S.
      </span>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
