import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Car, Copy, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/operacoes/constants';
import type { Carro } from '@/lib/operacoes/types';
import { useCarros } from '@/hooks/useOperacoes';

/**
 * Stock para o comercial (vista de chamada). Fonte única: tabela `carros` do
 * Supabase — a mesma que a Operações edita. Filtra-se por TIPO DE GESTÃO
 * (Venda / Aluguer), nunca por estado; dentro de cada tipo, as viaturas ainda
 * não disponíveis (em preparação / manutenção) aparecem esbatidas mas com toda
 * a informação, para o comercial poder agendar o interessado.
 */

type Gestao = 'Venda' | 'Aluguer';
type Disponibilidade = 'pronto' | 'preparacao' | 'manutencao';

const ESTADOS_STOCK = ['Para Venda', 'Para Aluguer', 'Em Preparação', 'Manutenção'];

function disponibilidade(v: Carro): Disponibilidade {
  if (v.estado === 'Em Preparação') return 'preparacao';
  if (v.estado === 'Manutenção') return 'manutencao';
  return 'pronto';
}

const ORDEM: Record<Disponibilidade, number> = { pronto: 0, preparacao: 1, manutencao: 2 };

const BADGE: Record<Disponibilidade, string> = {
  pronto: 'bg-emerald-500/15 text-emerald-300',
  preparacao: 'bg-indigo-500/15 text-indigo-300',
  manutencao: 'bg-amber-500/15 text-amber-300',
};

const vazio = (v: unknown) => v == null || String(v).trim() === '';
const txt = (v: unknown) => (vazio(v) ? '—' : String(v));
const eur = (v: unknown, sufixo = '') => (vazio(v) ? '—' : `${v} €${sufixo}`);
const km = (v: unknown) => (vazio(v) ? '—' : `${v} km`);

function dataPt(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

function fotosDe(v: Carro): string[] {
  const lista = Array.isArray(v.fotos) ? v.fotos.filter(Boolean) : [];
  if (v.foto_url && !lista.includes(v.foto_url)) lista.unshift(v.foto_url);
  return lista;
}

function precoPrincipal(v: Carro, gestao: Gestao) {
  return gestao === 'Aluguer'
    ? eur(v.valor_aluguer_semanal, '/sem')
    : eur(v.preco_venda);
}

function resumoWhatsApp(v: Carro, gestao: Gestao) {
  const titulo = [v.marca_modelo, v.versao].filter((x) => !vazio(x)).join(' ');
  const linhas = [
    titulo,
    [v.ano, vazio(v.kms_atuais) ? null : `${v.kms_atuais} km`, v.combustivel, v.caixa, v.cor]
      .filter((x) => !vazio(x))
      .join(' · '),
  ];
  if (gestao === 'Aluguer') {
    linhas.push(`Aluguer: ${eur(v.valor_aluguer_semanal, ' por semana')}`);
    if (!vazio(v.caucao)) linhas.push(`Caução: ${v.caucao} €`);
  } else {
    linhas.push(`Preço: ${eur(v.preco_venda)}`);
    const cred = [['120 meses', v.credito_120_meses], ['60 meses', v.credito_60_meses], ['48 meses', v.credito_48_meses]]
      .filter(([, x]) => !vazio(x))
      .map(([l, x]) => `${l}: ${x} €/mês`);
    if (cred.length) linhas.push(`Crédito (prestação): ${cred.join(' · ')}`);
  }
  if (disponibilidade(v) !== 'pronto') {
    const quando = dataPt(v.data_previsao_pronto);
    linhas.push(quando ? `Disponível a partir de ${quando}` : 'Ainda não disponível');
  }
  return linhas.filter(Boolean).join('\n');
}

function Linha({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border/60 py-1 last:border-b-0">
      <span className="w-[42%] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm text-foreground">{children}</span>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h3 className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary/80">
        {titulo}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function BadgeEstado({ v }: { v: Carro }) {
  const disp = disponibilidade(v);
  const quando = dataPt(v.data_previsao_pronto);
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-[11px] font-medium', BADGE[disp])}>
      {v.estado}
      {disp !== 'pronto' && quando ? ` · pronto a ${quando}` : ''}
    </span>
  );
}

/** Cartão compacto: miniatura pequena + dados essenciais (o foco é a informação, não a imagem). */
function CartaoViatura({
  v,
  gestao,
  selecionado,
  onSelect,
}: {
  v: Carro;
  gestao: Gestao;
  selecionado: boolean;
  onSelect: () => void;
}) {
  const disp = disponibilidade(v);
  const foto = fotosDe(v)[0];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-stretch gap-3 overflow-hidden rounded-xl border bg-card p-2 text-left transition',
        selecionado ? 'border-2 border-primary' : 'border-border hover:border-primary/50',
      )}
    >
      <div
        className={cn(
          'flex h-[72px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40',
          disp !== 'pronto' && 'opacity-60 grayscale',
        )}
      >
        {foto ? (
          <img src={foto} alt="" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <Car className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>
      <div className={cn('min-w-0 flex-1 space-y-0.5', disp !== 'pronto' && 'opacity-70')}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="line-clamp-1 font-display text-sm font-semibold text-foreground">
            {v.marca_modelo || 'Sem modelo'}
          </span>
          <span className="shrink-0 text-sm font-semibold text-foreground">
            {precoPrincipal(v, gestao)}
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {[v.ano, vazio(v.kms_atuais) ? null : `${v.kms_atuais} km`, v.combustivel]
            .filter((x) => !vazio(x))
            .join(' · ') || '—'}
        </div>
        <BadgeEstado v={v} />
      </div>
    </button>
  );
}

/** Planos de pagamento da caução (só para viaturas em aluguer). */
function CaucaoPlanos({ v }: { v: Carro }) {
  const fromDb = parseFloat(String(v.caucao ?? '0'));
  const fromPvp = parseFloat(String(v.preco_venda ?? '0'));
  const total = fromDb > 0 ? fromDb : fromPvp > 25000 ? 600 : 400;
  const meta = total === 600 ? '300€' : '200€';
  const p3 = total === 600 ? '+ 100€' : '';
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="mb-3 text-base font-semibold">
        💳 Caução: <span className="font-bold text-primary">{total}€</span>
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-muted/60 p-3">
          <div className="mb-1.5 font-semibold text-foreground">📋 Prestações Vianta</div>
          <div className="mb-2 text-xs text-muted-foreground">Sem juros, gerido internamente</div>
          <div className="text-2xl font-bold text-primary">{meta}</div>
          <div className="text-xs text-muted-foreground">1.ª prestação (entrega)</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Depois: <strong>100€</strong> + <strong>100€</strong> {p3} (mensal)
          </div>
        </div>
        <div className="rounded-md bg-muted/60 p-3">
          <div className="mb-1.5 font-semibold text-foreground">🏦 Parcela Já</div>
          <div className="mb-2 text-xs text-muted-foreground">Crédito no terminal, débito automático</div>
          <div className="mt-1 text-xs text-muted-foreground">
            <div className="mt-1 text-green-500">✅ CC português</div>
            <div className="text-green-500">✅ Cartão multibanco (mesma pessoa)</div>
            <div className="mt-1 text-yellow-400">Atenção: verificação BdP</div>
          </div>
          <div className="mt-2 rounded-md bg-indigo-500/15 px-2.5 py-1.5 text-[11px] text-indigo-300">
            ⚠️ Se faltar CC português ou cartão multibanco
            <br />
            da mesma pessoa → <span className="font-semibold text-primary">Opção 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Garantia de fábrica por marca (fonte: Offer Document / Garantias Stand). */
function garantiaFabrica(v: Carro): string | null {
  const m = normalizeText(v.marca_modelo || '');
  if (m.includes('hyundai')) return 'Hyundai: 7 anos sem limite de km · bateria 8 anos/160.000 km';
  if (/bmgb/.test(m)) return 'MG: 7 anos/150.000 km';
  if (m.includes('opel')) return 'Opel: 1 ano sem limite + 3 anos/90.000 km · bateria 8 anos/160.000 km';
  if (m.includes('tesla')) return 'Tesla: 4 anos/80.000 km · bateria/motor 8 anos (160-240.000 km consoante modelo)';
  return null;
}

function PainelOferta({ titulo, angulo, itens, naoE }: {
  titulo: string;
  angulo: string;
  itens: string[];
  naoE: string;
}) {
  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{titulo}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{angulo}</div>
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs text-foreground sm:grid-cols-2">
        {itens.map((i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[11px] text-muted-foreground">Não é para: {naoE}</div>
    </div>
  );
}

function OfertaAluguer() {
  return (
    <PainelOferta
      titulo="Oferta Aluguer TVDE"
      angulo="Entra esta semana. O teu único trabalho é conduzir."
      itens={[
        'Viatura pronta a trabalhar (dístico e seguro)',
        'Manutenção a cargo da Vianta',
        'Pagamentos semanais (segundas-feiras)',
        'Viatura de substituição garantida',
        'Saída com 15 dias de aviso, sem contrato longo',
        'Suporte direto com o gestor de frota',
        'App com histórico de despesas e ganhos',
      ]}
      naoE="quem já tem viatura própria (→ Slot) ou quer ser dono do carro (→ Venda)."
    />
  );
}

function OfertaVenda({ v }: { v: Carro }) {
  const fabrica = garantiaFabrica(v);
  return (
    <>
      <PainelOferta
        titulo="Oferta Venda TVDE"
        angulo="O carro certo, o crédito tratado, pronto a operar em TVDE."
        itens={[
          'Viatura pronta a operar (dístico, inspeção, extintor)',
          'Mediação de financiamento e seguro',
          'Garantia Standard Vianta: motor e caixa, 18 meses (extensível a 36, com custo adicional)',
          'Acompanhamento pós-venda',
          'Integração na frota Vianta com Slot',
        ]}
        naoE="quem não tem capital nem crédito aprovável (→ começar no Aluguer)."
      />
      {fabrica && (
        <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-foreground">
          <span className="font-semibold">Garantia de fábrica · </span>
          {fabrica}
        </div>
      )}
    </>
  );
}

/** Linha só aparece se tiver valor — para o comercial não ler "—" em tudo. */
function Dado({ label, valor }: { label: string; valor: string | null }) {
  if (valor == null) return null;
  return <Linha label={label}>{valor}</Linha>;
}

function Ficha({ v, gestao }: { v: Carro; gestao: Gestao }) {
  const fotos = fotosDe(v);
  const [foto, setFoto] = useState(0);
  const disp = disponibilidade(v);

  useEffect(() => {
    setFoto(0);
  }, [v.id]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumoWhatsApp(v, gestao));
      toast.success('Resumo copiado');
    } catch {
      toast.error('Não foi possível copiar o resumo');
    }
  };

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Foto pequena à esquerda */}
        <div className="w-full shrink-0 sm:w-56">
          <div
            className={cn(
              'flex aspect-[4/3] max-h-52 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40 sm:max-h-none',
              disp !== 'pronto' && 'opacity-70',
            )}
          >
            {fotos[foto] ? (
              <img src={fotos[foto]} alt="" className="h-full w-full object-contain" />
            ) : (
              <Car className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
          {fotos.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {fotos.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFoto(i)}
                  className={cn(
                    'h-9 w-12 shrink-0 overflow-hidden rounded border',
                    i === foto ? 'border-2 border-primary' : 'border-border',
                  )}
                >
                  <img src={f} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Identificação e valores à direita */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold leading-tight text-foreground">
                {v.marca_modelo || 'Sem modelo'}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[v.matricula, v.versao, v.cor, v.caixa].filter((x) => !vazio(x)).join(' · ') || '—'}
              </p>
              <div className="mt-1.5">
                <BadgeEstado v={v} />
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={copiar}>
              <Copy /> Copiar resumo
            </Button>
          </div>

          <div className={cn('mt-3 grid gap-2', gestao === 'Aluguer' ? 'grid-cols-2' : 'grid-cols-1')}>
            {(gestao === 'Aluguer'
              ? [
                  ['Aluguer / sem', eur(v.valor_aluguer_semanal)],
                  ['Caução', eur(v.caucao)],
                ]
              : [['Preço venda', eur(v.preco_venda)]]
            ).map(([label, valor]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-2.5 py-2">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="font-display text-base font-bold text-foreground">{valor}</div>
              </div>
            ))}
          </div>
          {gestao !== 'Aluguer' && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ['Crédito 120 m', eur(v.credito_120_meses, '/mês')],
              ['Crédito 60 m', eur(v.credito_60_meses, '/mês')],
              ['Crédito 48 m', eur(v.credito_48_meses, '/mês')],
            ].map(([label, valor]) => (
              <div key={label} className="rounded-lg border border-border px-2.5 py-1.5">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold text-foreground">{valor}</div>
              </div>
            ))}
          </div>
          )}
          {gestao === 'Aluguer' ? (
            <>
              <OfertaAluguer />
              <CaucaoPlanos v={v} />
            </>
          ) : (
            <OfertaVenda v={v} />
          )}
        </div>
      </div>

      {/* Só os dados que existem, agrupados */}
      {(() => {
        const t = (x: unknown) => (vazio(x) ? null : String(x));
        const blocos: { titulo: string; linhas: [string, string | null][] }[] = [
          {
            titulo: 'Viatura',
            linhas: [
              ['Matrícula', t(v.matricula)],
              ['Ano', t(v.ano)],
              ['KMs atuais', vazio(v.kms_atuais) ? null : `${v.kms_atuais} km`],
              ['Combustível', t(v.combustivel)],
              ['Caixa', t(v.caixa)],
              ['Cor', t(v.cor)],
              ['Cavalos', t(v.cavalos)],
              ['Bagageira', vazio(v.volume_bagageira) ? null : `${v.volume_bagageira} L`],
            ],
          },
          {
            titulo: 'Elétrico',
            linhas: [
              ['Autonomia', vazio(v.autonomia_km) ? null : `${v.autonomia_km} km`],
              ['Bateria', vazio(v.bateria_kwh) ? null : `${v.bateria_kwh} kWh`],
              ['Estado da bateria', vazio(v.estado_bateria_pct) ? null : `${v.estado_bateria_pct}%`],
            ],
          },
          {
            titulo: 'TVDE e garantias',
            linhas: [
              ['Categorias TVDE', t(v.categorias_tvde)],
              ['Fim elegibilidade', t(v.fim_elegibilidade_tvde)],
              ['Garantia viatura', t(v.garantia_viatura)],
              ['Garantia bateria', t(v.garantia_bateria)],
            ],
          },
        ];
        const visiveis = blocos.filter((b) => b.linhas.some(([, x]) => x != null));
        return (
          <div className="mt-4 border-t border-border pt-4 md:columns-2 md:gap-8 xl:columns-3">
            {visiveis.map((b) => (
              <Bloco key={b.titulo} titulo={b.titulo}>
                {b.linhas.map(([l, x]) => (
                  <Dado key={l} label={l} valor={x} />
                ))}
              </Bloco>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/** Valor numérico usado no filtro de preço: preço de venda (Venda) ou aluguer semanal (Aluguer). */
function valorNumerico(v: Carro, gestao: Gestao): number | null {
  const bruto = gestao === 'Aluguer' ? v.valor_aluguer_semanal : v.preco_venda;
  if (vazio(bruto)) return null;
  let s = String(bruto).replace(/[^\d.,]/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 17.900 → 17900
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Categorias TVDE escritas de várias formas na sheet → um nome único.
const CATEGORIA_CANONICA: Record<string, string> = {
  courier: 'Courier',
  womendrivers: 'Women Drivers',
  storepickup: 'Store Pickup',
  prioridade: 'Prioridade',
  priority: 'Prioridade',
  uberx: 'UberX',
  uberxl: 'UberXL',
  comfort: 'Comfort',
  confort: 'Comfort',
  electric: 'Electric',
  eletric: 'Electric',
  black: 'Black',
  green: 'Green',
};

function categoriasDe(v: Carro): string[] {
  const out = new Set<string>();
  for (const parte of String(v.categorias_tvde || '').split(/[,;+]/)) {
    const chave = normalizeText(parte).replace(/[^a-z]/g, '');
    if (!chave) continue;
    out.add(CATEGORIA_CANONICA[chave] || parte.trim());
  }
  return [...out];
}

// "GPL (gasolina)" e "GPL" contam como o mesmo combustível.
const combLabel = (c: string | null | undefined) => (c || '').replace(/\s*\(.*?\)\s*/g, '').trim();

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        ativo
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** true a partir de 1024 px (largura em que a ficha cabe ao lado da lista). */
function useDesktop() {
  const query = '(min-width: 1024px)';
  const [ok, setOk] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : true));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setOk(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return ok;
}

const Stock = () => {
  const { data: carros = [], isLoading, isError } = useCarros();
  const [gestao, setGestao] = useState<Gestao>('Venda');
  const [search, setSearch] = useState('');
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [fichaAberta, setFichaAberta] = useState(false);
  const desktop = useDesktop();

  const stock = useMemo(() => carros.filter((v) => ESTADOS_STOCK.includes(v.estado || '')), [carros]);

  const contagens = useMemo(
    () => ({
      Venda: stock.filter((v) => v.tipo_gestao === 'Venda').length,
      Aluguer: stock.filter((v) => v.tipo_gestao === 'Aluguer').length,
    }),
    [stock],
  );

  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [combs, setCombs] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);

  const doTipo = useMemo(() => stock.filter((v) => v.tipo_gestao === gestao), [stock, gestao]);

  // Opções dos filtros: só o que existe nas viaturas do separador atual.
  const combustiveis = useMemo(
    () => [...new Set(doTipo.map((v) => combLabel(v.combustivel)).filter(Boolean))].sort(),
    [doTipo],
  );
  const categorias = useMemo(
    () => [...new Set(doTipo.flatMap(categoriasDe))].sort((a, b) => a.localeCompare(b)),
    [doTipo],
  );

  const filtrosAtivos = !!(valorMin || valorMax || combs.length || cats.length);
  const limparFiltros = () => {
    setValorMin('');
    setValorMax('');
    setCombs([]);
    setCats([]);
  };
  const alternar = (lista: string[], valor: string, set: (l: string[]) => void) =>
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

  const visiveis = useMemo(() => {
    const q = normalizeText(search.trim());
    const min = valorMin ? Number(valorMin) : null;
    const max = valorMax ? Number(valorMax) : null;
    return doTipo
      .filter(
        (v) =>
          !q ||
          [v.marca_modelo, v.matricula, v.cor, v.versao].some((c) => normalizeText(c).includes(q)),
      )
      .filter((v) => {
        if (min == null && max == null) return true;
        const n = valorNumerico(v, gestao);
        if (n == null) return false; // sem valor definido não cabe numa gama de preço
        return (min == null || n >= min) && (max == null || n <= max);
      })
      .filter((v) => !combs.length || combs.includes(combLabel(v.combustivel)))
      .filter((v) => {
        if (!cats.length) return true;
        const tem = categoriasDe(v);
        return cats.every((c) => tem.includes(c)); // tem de ter TODAS as categorias escolhidas
      })
      .sort(
        (a, b) =>
          ORDEM[disponibilidade(a)] - ORDEM[disponibilidade(b)] ||
          (a.marca_modelo || '').localeCompare(b.marca_modelo || ''),
      );
  }, [doTipo, gestao, search, valorMin, valorMax, combs, cats]);

  const selecionado = visiveis.find((v) => v.id === selecionadoId) || visiveis[0] || null;
  const prontos = visiveis.filter((v) => disponibilidade(v) === 'pronto').length;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Stock</h1>
          <p className="text-sm text-muted-foreground">
            {visiveis.length} viaturas · {prontos} prontas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
            {(['Venda', 'Aluguer'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGestao(g);
                  limparFiltros();
                }}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  gestao === g ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g} · {contagens[g]}
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Modelo, matrícula, cor…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Filtros: valor, combustível e categorias TVDE */}
        <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {gestao === 'Aluguer' ? 'Aluguer (€/sem)' : 'Valor (€)'}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={valorMin}
                onChange={(e) => setValorMin(e.target.value)}
                placeholder="Mín."
                className="h-8 w-24 text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={valorMax}
                onChange={(e) => setValorMax(e.target.value)}
                placeholder="Máx."
                className="h-8 w-24 text-xs"
              />
            </div>
            {combustiveis.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Combustível</span>
                {combustiveis.map((c) => (
                  <Chip key={c} ativo={combs.includes(c)} onClick={() => alternar(combs, c, setCombs)}>
                    {c}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          {categorias.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">Categorias TVDE</span>
              {categorias.map((c) => (
                <Chip key={c} ativo={cats.includes(c)} onClick={() => alternar(cats, c, setCats)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
          {filtrosAtivos && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {visiveis.length} de {doTipo.length} viaturas
              </span>
              <button type="button" onClick={limparFiltros} className="text-primary hover:underline">
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {isError ? (
          <div className="rounded-xl border border-border p-8 text-center text-sm text-destructive">
            Erro ao carregar o stock.
          </div>
        ) : isLoading ? (
          <Skeleton className="h-[400px] rounded-xl" />
        ) : !visiveis.length ? (
          <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
            {search
              ? `Nenhum resultado para "${search}"`
              : filtrosAtivos
                ? 'Nenhuma viatura com estes filtros.'
                : `Sem viaturas em ${gestao.toLowerCase()}`}
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {visiveis.map((v) => (
                <CartaoViatura
                  key={v.id}
                  v={v}
                  gestao={gestao}
                  selecionado={selecionado?.id === v.id}
                  onSelect={() => {
                    setSelecionadoId(v.id);
                    if (!desktop) setFichaAberta(true);
                  }}
                />
              ))}
            </div>
            {/* Ecrã largo: ficha ao lado da lista */}
            {desktop && (
              <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
                {selecionado && <Ficha v={selecionado} gestao={gestao} />}
              </div>
            )}
          </div>
        )}

        {/* Telemóvel/tablet: a ficha abre num pop-up ao tocar na viatura */}
        {!desktop && (
          <Dialog open={fichaAberta && !!selecionado} onOpenChange={setFichaAberta}>
            <DialogContent
              className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-xl grid-cols-[minmax(0,1fr)] overflow-y-auto p-0"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">Ficha da viatura</DialogTitle>
              {selecionado && <Ficha v={selecionado} gestao={gestao} />}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Stock;
