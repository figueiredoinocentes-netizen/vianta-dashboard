import { useEffect, useMemo, useRef, useState, type ReactNode, useCallback } from 'react';
import { RefreshCw, Cpu, Database, Zap, Mic, Square, Volume2, MicOff, MessageSquareText, Map as MapIcon, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * AI OS — Live: o mesmo visualizador do estado do sistema (agentes, crons,
 * integrações, skills) mas nativo no dashboard. Lê o snapshot publicado em
 * /aios-live/aios-state.json (regenerado pelo cron de 10 min).
 */
const STATE_URL = '/aios-live/aios-state.json';
const VOICE_URL = 'https://thomas-requires-congress-hunter.trycloudflare.com/voice';

interface Cron {
  id?: string;
  name?: string;
  owner?: string;
  schedule?: string;
  state?: string;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  no_agent?: boolean;
  skills?: string[];
  next_run_at?: string | null;
}
interface Profile {
  name?: string;
  role?: string;
  desc?: string;
  gateway?: { up?: boolean; pid?: string | number | null } | null;
  crons?: Cron[];
}
interface Skill { name?: string; description?: string; }
interface AiosState {
  generated_at?: string;
  profiles?: Profile[];
  skills?: Skill[];
  mcp?: { name?: string; url?: string }[];
  supabase?: Record<string, number | null>;
  ghl?: { ok?: boolean | null; status?: number } | null;
  integrations?: Record<string, { ok?: boolean | null; note?: string }>;
  alerts?: string[];
  gateways?: Record<string, { up?: boolean; pid?: string | null }>;
}

function rel(iso?: string | null): string {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) return 'agora';
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const dotClass = (status?: string | null) =>
  status === 'error' ? 'bg-rose-400 shadow-[0_0_6px_#fb7185]'
  : status === 'paused' ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
  : 'bg-emerald-400 shadow-[0_0_6px_#34d399]';

const pillClass = (kind: string) =>
  kind === 'ok' ? 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10'
  : kind === 'err' ? 'text-rose-400 border-rose-400/40 bg-rose-400/10'
  : kind === 'warn' ? 'text-amber-400 border-amber-400/40 bg-amber-400/10'
  : 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10';

function Pill({ children, kind }: { children: ReactNode; kind: string }) {
  return <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[11px] leading-none', pillClass(kind))}>{children}</span>;
}

function Dot({ kind }: { kind: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', kind === 'ok' ? 'bg-emerald-400' : kind === 'err' ? 'bg-rose-400' : kind === 'warn' ? 'bg-amber-400' : 'bg-slate-500')} />;
}

function CronRow({ c }: { c: Cron }) {
  const st = c.state === 'paused' ? 'paused' : c.last_status === 'error' ? 'error' : 'ok';
  const kind = c.state === 'paused' ? 'warn' : c.last_status === 'error' ? 'err' : 'ok';
  const extra = [(c.no_agent ? 'script' : 'agente'), c.skills?.length ? c.skills.join(', ') : null].filter(Boolean).join(' · ');
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/40">
      <td className="px-3 py-2"><Pill kind="ok">{c.owner || '—'}</Pill></td>
      <td className="px-3 py-2">
        <div className="text-[13px] font-medium text-foreground">{c.name}</div>
        {extra && <div className="text-[10px] text-muted-foreground">{extra}</div>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{c.schedule || '—'}</td>
      <td className="px-3 py-2"><Pill kind={kind}>{c.state === 'paused' ? 'paused' : c.last_status || '—'}</Pill></td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{rel(c.last_run_at)}</td>
      <td className="px-3 py-2">
        {c.last_status === 'error' ? (
          <span className="block max-w-[300px] truncate text-[11px] text-rose-400" title={(c.last_error || '').slice(0, 500)}>
            {(c.last_error || 'erro').slice(0, 110)}
          </span>
        ) : c.last_run_at ? (
          <span className="text-[11px] text-muted-foreground">next {rel(c.next_run_at)}</span>
        ) : '—'}
      </td>
    </tr>
  );
}

function AgentCard({ p, kind }: { p: Profile; kind: 'ceo' | 'bot' | 'team' }) {
  const gw = p.gateway;
  const gwColor = gw ? (gw.up ? 'text-emerald-400' : 'text-rose-400') : 'text-muted-foreground';
  const border = kind === 'ceo' ? 'border-cyan-500/50' : kind === 'bot' ? 'border-amber-500/40' : 'border-border';
  return (
    <div className={cn('min-w-[250px] flex-1 max-w-[360px] rounded-xl border bg-card p-4', border)}>
      <div className="mb-1 flex items-center gap-2">
        <Dot kind={gw ? (gw.up ? 'ok' : 'err') : 'off'} />
        <span className="text-sm font-semibold text-foreground">{p.name}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {kind === 'ceo' ? 'CEO' : 'bot'}
        </code>
      </div>
      <div className="mb-2 text-[11px] text-muted-foreground">{p.role}</div>
      <div className={cn('mb-2 text-[11px]', gwColor)}>
        gateway <b>{gw ? (gw.up ? 'up' : 'down') : '—'}</b>
        {gw?.pid ? ` · PID ${gw.pid}` : ''}
      </div>
      <div className="space-y-1">
        {(p.crons?.length ? p.crons : []).map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1 text-[11px] text-foreground/90"
               title={c.last_error || c.name}>
            <span className={cn('h-1.5 w-1.5 rounded-full', dotClass(c.last_status))} />
            <span className="truncate">{c.name}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{c.schedule || ''}</span>
          </div>
        ))}
        {!p.crons?.length && <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground"><Dot kind="off" />sem crons próprios</div>}
      </div>
    </div>
  );
}

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
          setText(prev => {
              // Se é interim, mostramos apenas, se é final podemos querer acumular ou substituir
              return currentText;
          });

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

type AiosView = 'mundo' | 'painel';
const VIEW_KEY = 'aios-view';

function ViewSwitch({ view, onChange }: { view: AiosView; onChange: (v: AiosView) => void }) {
  const btn = (v: AiosView, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        view === v ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-400' : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}{label}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {btn('mundo', 'Mundo', <MapIcon className="h-3.5 w-3.5" />)}
      {btn('painel', 'Painel', <LayoutList className="h-3.5 w-3.5" />)}
    </div>
  );
}

const AiosPage = () => {
  const [state, setState] = useState<AiosState | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [view, setViewState] = useState<AiosView>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'painel' ? 'painel' : 'mundo'; } catch { return 'mundo'; }
  });
  const setView = (v: AiosView) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignora */ }
  };

  const load = async () => {
    try {
      const r = await fetch(`${STATE_URL}?t=${Date.now()}`);
      if (!r.ok) throw new Error(String(r.status));
      setState(await r.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    load();
    const t1 = setInterval(load, 60000);
    const t2 = setInterval(() => setNow(Date.now()), 5000);
    return () => { clearInterval(t1); clearInterval(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crons = useMemo(() => (state?.profiles || []).flatMap((p) => (p.crons || []).map((c) => ({ ...c, owner: c.owner || p.name }))), [state]);

  if (view === 'mundo') {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <h1 className="font-display text-sm font-bold text-foreground">AI OS</h1>
          <ViewSwitch view={view} onChange={setView} />
        </div>
        <iframe
          title="AI OS — Mundo Vianta"
          src="/aios-live/mundo.html"
          className="block h-[calc(100dvh-100px)] w-full border-0 lg:h-[calc(100dvh-49px)]"
        />
      </DashboardLayout>
    );
  }

  if (failed) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 text-sm text-rose-400">
            Não consegui ler o estado do AI OS. Verifica se o snapshot está publicado
            (<code className="font-mono">/aios-live/aios-state.json</code>) ou clica em “Atualizar”.
          </div>
        </div>
      </DashboardLayout>
    );
  }
  if (!state) {
    return <DashboardLayout><div className="p-6 text-sm text-muted-foreground">A carregar estado do AI OS…</div></DashboardLayout>;
  }

  const nOk = crons.filter((c) => c.last_status === 'ok').length;
  const nErr = crons.filter((c) => c.last_status === 'error' && c.state !== 'paused').length;
  const nPaused = crons.filter((c) => c.state === 'paused').length;
  const gwUp = Object.values(state.gateways || {}).filter((g) => g.up).length;
  const gwTotal = Object.keys(state.gateways || {}).length;
  const sb = state.supabase || {};
  const find = (n: string) => (state.profiles || []).find((p) => p.name === n);

  return (
    <DashboardLayout>
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
          </span>
          <h1 className="font-display text-lg font-bold text-foreground">AI OS — Live</h1>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
        <span className="text-xs text-muted-foreground">snapshot há {rel(state.generated_at)} · auto-refresh 60s</span>
        <div className="ml-auto"><ViewSwitch view={view} onChange={setView} /></div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
          Crons <b className="text-foreground">{crons.length}</b>
          <span className="ml-1 text-emerald-400">· {nOk} ok</span>
          {nErr > 0 && <span className="ml-1 text-rose-400">· {nErr} erro</span>}
          {nPaused > 0 && <span className="ml-1 text-amber-400">· {nPaused} pausados</span>}
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
          Gateways <b className="text-foreground">{gwUp}/{gwTotal}</b> up
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
          Skills <b className="text-foreground">{state.skills?.length || 0}</b>
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
          MCP <b className="text-foreground">{state.mcp?.length || 0}</b> {(state.mcp || []).map((m) => m.name).join(', ')}
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
          GHL <b className={state.ghl?.ok ? 'text-emerald-400' : 'text-rose-400'}>{state.ghl?.ok ? 'OK' : 'DOWN'}</b>
        </span>
      </div>

      {(state.alerts || []).length > 0 && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-xs whitespace-pre-line text-rose-400">
          {(state.alerts || []).join('\n')}
        </div>
      )}

      {/* Hierarquia */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-cyan-500">Hierarquia de Agentes</h2>
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            {[['Telegram', 'Vianta Jarvis'], ['Desktop', 'Hermes app'], ['Facebook / Instagram', 'via GHL'], ['Email', 'geral@vianta.pt']].map(([c, s]) => (
              <div key={c} className="rounded-lg border border-cyan-900/60 bg-cyan-950/30 px-3 py-1.5 text-center text-xs text-cyan-300">
                {c}
                <div className="text-[10px] text-muted-foreground">{s}</div>
              </div>
            ))}
          </div>
          <div className="text-muted-foreground">▼</div>
          <div className="flex w-full justify-center"><AgentCard p={find('jarvis')!} kind="ceo" /></div>
          <div className="text-xs text-muted-foreground">▼ delegate_task / cron ▼</div>
          <div className="flex w-full flex-wrap justify-center gap-4">
            {['turismo-frota', 'agente-comercial'].map((n) => find(n)).filter(Boolean).map((p) => <AgentCard key={p!.name} p={p!} kind="bot" />)}
            {['francisco', 'duarte', 'vianta'].map((n) => find(n)).filter(Boolean).map((p) => <AgentCard key={p!.name} p={p!} kind="team" />)}
          </div>
        </div>
      </section>

      {/* Crons */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
          <Zap className="h-3.5 w-3.5" /> Crons & Routines
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Schedule</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Última execução</th>
                <th className="px-3 py-2 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {crons.map((c) => <CronRow key={c.id} c={c} />)}
            </tbody>
          </table>
        </div>
      </section>

      {/* Integrações */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
          <Database className="h-3.5 w-3.5" /> Integrações & Bases de Dados
        </h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {[
            { name: 'GHL CRM', ok: state.ghl?.ok ?? null, note: 'contacts · pipelines Aluguer + Venda · Messenger/IG', meta: state.ghl?.ok != null ? (state.ghl.ok ? 'health OK (200)' : 'health DOWN') : 'sem health' },
            { name: 'Supabase', ok: true, note: 'fonte de verdade · stock carros · transfers · cc_*', meta: [sb.carros != null ? `carros ${sb.carros}` : '', sb.transfers != null ? `transfers ${sb.transfers}` : '', sb.cc_services != null ? `cc_services ${sb.cc_services}` : '', sb.cc_offers != null ? `cc_offers ${sb.cc_offers}` : ''].filter(Boolean).join(' · ') },
            { name: 'Composio MCP', ok: true, note: 'Gmail · Sheets · Drive (conta duarte.inocentes@vianta.pt)' },
            { name: 'Google Sheets', ok: true, note: 'DB Transfers · Drivers Transfers · propostas' },
            { name: 'Gmail', ok: true, note: 'geral@vianta.pt via Composio' },
            { name: 'Frota360', ok: null, note: 'sync diário → Supabase' },
            { name: 'Meta Ads API', ok: false, note: 'conta 293842623 · sem token', meta: 'bloqueado' },
            { name: 'Google Drive', ok: true, note: 'docs fonte autoritativa' },
            { name: 'Netlify', ok: true, note: 'app transfers · gerador propostas · dashboard' },
          ].map((it) => (
            <div key={it.name} className="rounded-lg border border-border bg-background/50 p-3">
              <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Dot kind={it.ok === true ? 'ok' : it.ok === false ? 'err' : 'warn'} /> {it.name}
              </div>
              <div className="text-[11px] text-muted-foreground">{it.note}</div>
              {'meta' in it && it.meta && <div className="mt-1 text-[10px] text-muted-foreground/70">{it.meta}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
          <Cpu className="h-3.5 w-3.5" /> Skills Vianta ({state.skills?.length || 0})
        </h2>
        <div className="flex flex-wrap gap-2">
          {(state.skills || []).map((s) => (
            <div key={s.name} className="rounded-lg border border-emerald-400/25 bg-emerald-950/25 px-2.5 py-1.5">
              <div className="text-xs text-emerald-300">{s.name}</div>
              {s.description && <div className="text-[10px] text-muted-foreground">{s.description}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Voz */}
      <VoiceAssistant />

      <footer className="pb-4 text-center text-[10px] text-muted-foreground/60">
        snapshot gerado por aios_snapshot.py (cron 10 min) · atualização automática
      </footer>
    </div>
    </DashboardLayout>
  );
};

export default AiosPage;