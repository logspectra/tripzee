import { useCallback, useEffect, useState } from 'react';
import type { Locale } from './types';

/** Text-to-speech via the browser's Web Speech API (no server or key needed). */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const hasVoice = useCallback((locale: Locale) => voices.some((v) => v.lang.toLowerCase().startsWith(locale)), [voices]);

  const speak = useCallback(
    (text: string, locale: Locale) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#>]/g, ''));
      u.lang = locale === 'hi' ? 'hi-IN' : 'en-IN';
      const voice = voices.find((v) => v.lang === u.lang) ?? voices.find((v) => v.lang.toLowerCase().startsWith(locale));
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [supported, voices],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, speaking, speak, stop, hasVoice };
}
