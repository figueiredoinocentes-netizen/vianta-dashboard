import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Square, Volume2, MicOff, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Aios3DView from '@/components/aios3d/Aios3DView';
import type { SnapState } from '@/lib/aios/orbitGraph';

/**
 * AI OS — centro de comando: Órbita 3D com o estado ao vivo do sistema.
 * Lê o snapshot publicado em /aios-live/aios-state.json (regenerado pelo cron de 10 min).
 */
const STATE_URL = 'https://vianta-dashboard.netlify.app/aios-live/aios-state.json';
const VOICE_URL = 'https://thomas-requires-congress-hunter.trycloudflare.com/voice';

function VoiceAssistant() {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [autoMode, setAutoMode] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const recRef = useRef<{ stop: () => void; start: () => void; abort: () => void } | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoModeRef = useRef(autoMode);

  // Mantém a ref sincronizada com o estado para os callbacks
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const speak = useCallback((t: string) => {
    try {
      const u = new SpeechSynthesisUtterance(t);
      // Tenta apanhar a melhor voz PT-PT disponível
      const ptVoices = voices.filter(v => v.lang.startsWith('pt-PT') || v.lang.startsWith('pt_PT'));
      // Algumas vozes específicas costumam ser melhores:
      const preferred = ptVoices.find(v => v.name.includes('Joana') || v.name.includes('Catarina') || v.name.includes('Microsoft') || v.name.includes('Neural')) || ptVoices[0];
      
      if (preferred) u.voice = preferred;
      u.lang = 'pt-PT';
      u.rate = 1.05;
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);

      u.onend = () => {
        // Se estivermos em modo auto e não houver erro/busy, volta a ouvir após falar
        if (autoModeRef.current) {
            setTimeout(() => startListening(), 500); // pequena pausa antes de voltar a ouvir
        }
      };
      
    } catch {
      /* tts indisponível no browser */
    }
  }, [voices]);

  const send = useCallback(async (textToSend: string) => {
    const t = textToSend.trim();
    if (!t || busy) return;
    
    // Parar reconhecimento se for envio manual ou auto
    if (listening) {
        recRef.current?.stop();
    }
    
    setBusy(true); setError(''); setReply('');
    try {
      const r = await fetch(VOICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const d = await r.json();
      if (d.ok) { 
          setReply(d.response); 
          speak(d.response); 
          setText(''); // limpa o input após envio com sucesso
      }
      else setError(d.error || 'Sem resposta');
    } catch (e) {
      setError('Não consegui chegar ao Jarvis. O servidor de voz estará desligado?');
      setAutoMode(false); // desativa auto-mode em caso de erro fatal
    } finally {
      setBusy(false);
    }
  }, [busy, listening, speak]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('O reconhecimento de voz não é suportado neste browser. Usa o Chrome.'); return; }
    
    if (recRef.current) {
        try { recRef.current.abort(); } catch(e){}
    }

    const rec = new SR();
    rec.lang = 'pt-PT';
    rec.interimResults = true; // Necessário para o auto-send funcionar fluido
    rec.maxAlternatives = 1;
    rec.continuous = true; // Grava até mandarmos parar

    rec.onresult = (e: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interimTranscript += e.results[i][0].transcript;
        }
      }
      
      const currentText = finalTranscript || interimTranscript;
      if (currentText.trim()) {
          setText(currentText);

          // Reset ao timeout de silêncio
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          
          if (autoModeRef.current) {
              // Se tivermos texto final ou o user se calou por 2 segundos, envia.
              if (finalTranscript.trim()) {
                  silenceTimeoutRef.current = setTimeout(() => {
                      send(finalTranscript);
                  }, 1500); // 1.5s de silêncio = envio automático
              } else if (interimTranscript.trim()) {
                 silenceTimeoutRef.current = setTimeout(() => {
                      send(interimTranscript);
                  }, 2500); // 2.5s se for só interim
              }
          }
      }
    };

    rec.onend = () => {
        setListening(false);
        // Reinicia se ainda estiver em auto mode e não estiver ocupado (busy)
        if (autoModeRef.current && !busy) {
             startListening();
        }
    };
    
    rec.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
            setError(`Erro no mic: ${e.error}`);
            setAutoMode(false);
        }
        setListening(false);
    };

    recRef.current = rec;
    setError('');
    setListening(true);
    
    try {
        rec.start();
    } catch(e) {
        // Ignora erro se já estiver a gravar
    }
  }, [send, busy]);

  const toggleMic = () => {
    if (listening || autoMode) {
      // Parar tudo
      setAutoMode(false);
      setListening(false);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      recRef.current?.stop();
    } else {
      // Iniciar manual (só uma vez)
      setAutoMode(false);
      startListening();
    }
  };

  const toggleAutoMode = () => {
      const newMode = !autoMode;
      setAutoMode(newMode);
      if (newMode) {
          startListening();
      } else {
          setListening(false);
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          recRef.current?.stop();
      }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
            <Mic className="h-3.5 w-3.5" /> Assistente de Voz — fala com o Jarvis
          </h2>
          <button
            onClick={toggleAutoMode}
            className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-colors border",
                autoMode 
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" 
                    : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {autoMode ? <MessageSquareText className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            {autoMode ? "Modo Contínuo Ativo" : "Ativar Modo Contínuo"}
          </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={toggleMic}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full border transition-all shrink-0',
            listening
              ? 'border-rose-400 bg-rose-400/20 text-rose-400 animate-pulse'
              : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20',
          )}
          title={listening || autoMode ? 'Parar gravação' : 'Falar (uma vez)'}
        >
          {listening || autoMode ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(text)}
            placeholder={listening ? "A ouvir..." : "O que disseste aparece aqui… (ou escreve e carrega Enter)"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cyan-500/50 transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => send(text)}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-cyan-500/15 border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-40"
            >
              {busy ? 'A perguntar ao Jarvis…' : 'Enviar'}
            </button>
            {reply && (
              <button
                onClick={() => speak(reply)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Volume2 className="h-3.5 w-3.5" /> Repetir resposta
              </button>
            )}
          </div>
        </div>
      </div>
      {busy && <div className="mt-3 text-xs text-muted-foreground animate-pulse">O Jarvis está a pensar…</div>}
      {reply && (
        <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-950/20 p-3 text-sm text-emerald-300">
          {reply}
        </div>
      )}
      {error && <div className="mt-3 rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-xs text-rose-400">{error}</div>}
    </section>
  );
}

const AiosPage = () => {
  const [state, setState] = useState<SnapState | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    // Produção e deploy previews leem o snapshot publicado; em local (sem CORS) cai para o ficheiro do repo.
    for (const url of [STATE_URL, '/aios-live/aios-state.json']) {
      try {
        const r = await fetch(`${url}?t=${Date.now()}`);
        if (!r.ok) throw new Error(String(r.status));
        setState(await r.json());
        setFailed(false);
        return;
      } catch {
        /* tenta o próximo */
      }
    }
    setFailed(true);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed && !state) {
    return (
      <DashboardLayout>
        <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 text-sm text-rose-400">
          Não consegui ler o estado do AI OS. Verifica se o snapshot está publicado
          (<code className="font-mono">/aios-live/aios-state.json</code>).
        </div>
      </DashboardLayout>
    );
  }
  if (!state) {
    return <DashboardLayout><div className="text-sm text-muted-foreground">A carregar estado do AI OS…</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-[#141821]">
          <Aios3DView state={state} />
        </section>
        <VoiceAssistant />
        <footer className="pb-4 text-center text-[10px] text-muted-foreground/60">
          snapshot gerado por aios_snapshot.py (cron 10 min) · atualização automática a cada 60 s
        </footer>
      </div>
    </DashboardLayout>
  );
};

export default AiosPage;
