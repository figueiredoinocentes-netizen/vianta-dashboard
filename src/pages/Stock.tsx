import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Car, Copy, ExternalLink, Eye, EyeOff, Search } from 'lucide-react';
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

function LinkExterno({ href }: { href: string | null | undefined }) {
  if (vazio(href)) return <>—</>;
  const url = String(href);
  if (!/^https?:\/\//i.test(url)) return <>{url}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      Abrir <ExternalLink className="h-3 w-3" />
    </a>
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

function Ficha({ v, gestao }: { v: Carro; gestao: Gestao }) {
  const fotos = fotosDe(v);
  const [foto, setFoto] = useState(0);
  const [interno, setInterno] = useState(false);
  const disp = disponibilidade(v);

  useEffect(() => {
    setFoto(0);
    setInterno(false);
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['Preço venda', eur(v.preco_venda)],
              ['Aluguer / sem', eur(v.valor_aluguer_semanal)],
              ['Caução', eur(v.caucao)],
            ].map(([label, valor]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-2.5 py-2">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="font-display text-base font-bold text-foreground">{valor}</div>
              </div>
            ))}
          </div>
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
        </div>
      </div>

      {/* Restante informação em colunas, sem espaço vazio */}
      <div className="mt-4 border-t border-border pt-4 md:columns-2 md:gap-8 xl:columns-3">
        <Bloco titulo="Viatura">
          <Linha label="Marca / modelo">{txt(v.marca_modelo)}</Linha>
          <Linha label="Versão">{txt(v.versao)}</Linha>
          <Linha label="Matrícula">{txt(v.matricula)}</Linha>
          <Linha label="Ano">{txt(v.ano)}</Linha>
          <Linha label="KMs atuais">{km(v.kms_atuais)}</Linha>
          <Linha label="Combustível">{txt(v.combustivel)}</Linha>
          <Linha label="Cor">{txt(v.cor)}</Linha>
          <Linha label="Caixa">{txt(v.caixa)}</Linha>
        </Bloco>

        <Bloco titulo="Motorização">
          <Linha label="Cavalos">{txt(v.cavalos)}</Linha>
          <Linha label="Autonomia">{km(v.autonomia_km)}</Linha>
          <Linha label="Bateria">{vazio(v.bateria_kwh) ? '—' : `${v.bateria_kwh} kWh`}</Linha>
          <Linha label="Estado da bateria">
            {vazio(v.estado_bateria_pct) ? '—' : `${v.estado_bateria_pct}%`}
          </Linha>
          <Linha label="Bagageira">{vazio(v.volume_bagageira) ? '—' : `${v.volume_bagageira} L`}</Linha>
        </Bloco>

        <Bloco titulo="TVDE e garantias">
          <Linha label="Categorias TVDE">{txt(v.categorias_tvde)}</Linha>
          <Linha label="Fim elegibilidade">{txt(v.fim_elegibilidade_tvde)}</Linha>
          <Linha label="Garantia viatura">{txt(v.garantia_viatura)}</Linha>
          <Linha label="Garantia bateria">{txt(v.garantia_bateria)}</Linha>
        </Bloco>

        <Bloco titulo="Comercial">
          <Linha label="Tipo de gestão">{txt(v.tipo_gestao)}</Linha>
          <Linha label="Estado">{txt(v.estado)}</Linha>
          <Linha label="Pronto previsto">{txt(dataPt(v.data_previsao_pronto))}</Linha>
          <Linha label="Motorista atual">{txt(v.motorista_atual)}</Linha>
          <Linha label="Documentos">
            <LinkExterno href={v.docs_link} />
          </Linha>
          <Linha label="Fotos">
            <LinkExterno href={v.fotos_link} />
          </Linha>
          <Linha label="Observações">{txt(v.obs)}</Linha>
        </Bloco>
      </div>

      <div className="mt-1 rounded-lg border border-dashed border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setInterno((s) => !s)}
          className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
        >
          <span>Dados internos — não mostrar ao cliente</span>
          {interno ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {interno && (
          <div className="mt-1">
            <Linha label="Proprietário">{txt(v.proprietario)}</Linha>
          </div>
        )}
      </div>
    </div>
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

  const visiveis = useMemo(() => {
    const q = normalizeText(search.trim());
    return stock
      .filter((v) => v.tipo_gestao === gestao)
      .filter(
        (v) =>
          !q ||
          [v.marca_modelo, v.matricula, v.cor, v.versao].some((c) => normalizeText(c).includes(q)),
      )
      .sort(
        (a, b) =>
          ORDEM[disponibilidade(a)] - ORDEM[disponibilidade(b)] ||
          (a.marca_modelo || '').localeCompare(b.marca_modelo || ''),
      );
  }, [stock, gestao, search]);

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
                onClick={() => setGestao(g)}
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

        {isError ? (
          <div className="rounded-xl border border-border p-8 text-center text-sm text-destructive">
            Erro ao carregar o stock.
          </div>
        ) : isLoading ? (
          <Skeleton className="h-[400px] rounded-xl" />
        ) : !visiveis.length ? (
          <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
            {search ? `Nenhum resultado para "${search}"` : `Sem viaturas em ${gestao.toLowerCase()}`}
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
