import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Pause, Send, Sparkles, Volume2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { useSpeech } from '../lib/speech';
import type { AssistantReply, DestinationCard as Card } from '../lib/types';
import { DestinationCard } from '../components/DestinationCard';
import { Badge, Button, Input, Notice, PageHeader, cx } from '../components/ui';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  source?: 'llm' | 'rules';
  destinations?: Card[];
}

/** Renders the small subset of markdown the assistant uses (**bold**, _italic_, line breaks) without HTML injection. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={line.startsWith('•') ? 'pl-2' : undefined}>
          {line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, j) =>
            part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={j}>{part.slice(1, -1)}</em> : part,
          )}
        </p>
      ))}
    </>
  );
}

export default function Assistant() {
  const { t, locale } = useI18n();
  const speech = useSpeech();
  const meta = useAsync((signal) => api<{ aiEnabled: boolean }>('/meta', { signal }), []);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions(locale === 'hi'
      ? ['ताज महल का इतिहास बताइए', 'वाराणसी घूमने का सबसे अच्छा समय?', 'लखनऊ में क्या देखें?']
      : ['Tell me the history of the Taj Mahal', 'Best time to visit Varanasi?', 'What should I see in Lucknow?']);
  }, [locale]);

  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [turns.length, busy]);
  useEffect(() => { if (!speech.speaking) setSpeakingIdx(null); }, [speech.speaking]);

  async function ask(message: string, e?: FormEvent) {
    e?.preventDefault();
    const m = message.trim();
    if (!m || busy) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((ts) => [...ts, { role: 'user', content: m }]);
    setText('');
    setBusy(true);
    setError(null);
    try {
      const r = await api<AssistantReply>('/assistant', { method: 'POST', body: { message: m, locale, history } });
      setTurns((ts) => [...ts, { role: 'assistant', content: r.reply, source: r.source, destinations: r.destinations }]);
      if (r.suggestions.length) setSuggestions(r.suggestions);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-4 py-10 sm:px-6">
      <PageHeader
        title={t('assistant.title')}
        subtitle={locale === 'hi' ? 'हिंदी या अंग्रेज़ी में पूछें। जवाब सुनने के लिए 🔊 दबाएँ।' : 'Ask in English or Hindi. Tap 🔊 to hear an answer.'}
        actions={meta.data && <Badge tone={meta.data.aiEnabled ? 'brand' : 'slate'}>{meta.data.aiEnabled ? <><Sparkles className="h-3.5 w-3.5" /> AI answers</> : <><Bot className="h-3.5 w-3.5" /> Answers from Tripzee's guide data (no AI key)</>}</Badge>}
      />
      <div className="min-h-[50vh] flex-1 space-y-4 rounded-2xl border border-line bg-slate-50/50 p-4 sm:p-6" aria-live="polite">
        {turns.length === 0 && (
          <div className="py-10 text-center text-muted">
            <Bot className="mx-auto mb-3 h-10 w-10 text-brand-600" />
            <p>{locale === 'hi' ? 'मैं इतिहास, घूमने के समय, आसपास की जगहों और आपातकालीन मदद में सहायता कर सकता हूँ।' : 'I can help with history, culture, best times to visit, nearby places and emergencies.'}</p>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={cx('flex flex-col', turn.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cx('max-w-[90%] space-y-1 rounded-2xl px-4 py-3 text-sm leading-relaxed', turn.role === 'user' ? 'bg-brand-700 text-white' : 'border border-line bg-white text-ink')}>
              <Rich text={turn.content} />
            </div>
            {turn.role === 'assistant' && (
              <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                <span>{turn.source === 'llm' ? 'AI answer · may contain mistakes' : 'From Tripzee guide data'}</span>
                {speech.supported && (
                  <button className="inline-flex items-center gap-1 hover:text-brand-700" onClick={() => {
                    if (speakingIdx === i) { speech.stop(); return; }
                    speech.speak(turn.content, locale);
                    setSpeakingIdx(i);
                  }}>
                    {speakingIdx === i ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />} {speakingIdx === i ? t('common.stop') : t('common.listen')}
                  </button>
                )}
              </div>
            )}
            {turn.destinations && turn.destinations.length > 0 && (
              <div className="mt-2 grid w-full max-w-[90%] gap-3 sm:grid-cols-2">{turn.destinations.slice(0, 2).map((d) => <DestinationCard key={d.id} d={d} compact />)}</div>
            )}
          </div>
        ))}
        {busy && <div className="w-24 animate-pulse rounded-2xl border border-line bg-white px-4 py-3 text-sm text-muted">…</div>}
        <div ref={end} />
      </div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted hover:border-brand-200 hover:text-brand-800">{s}</button>)}
      </div>
      <form onSubmit={(e) => ask(text, e)} className="mt-3 flex gap-2">
        <Input aria-label="Your question" maxLength={1000} placeholder={t('assistant.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" loading={busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
      {speech.supported && locale === 'hi' && !speech.hasVoice('hi') && <p className="mt-2 text-xs text-muted">No Hindi voice is installed on this device — audio may use a default voice.</p>}
      {!speech.supported && <p className="mt-2 text-xs text-muted">Audio narration isn't supported in this browser.</p>}
    </div>
  );
}
