import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  criarDeclaracao,
  eliminarDeclaracao,
  extrairDocumentos,
  listClientesFinanciamento,
  type DeclaracaoDados,
} from '@/lib/operacoes/central';
import type { Carro, DriveFile } from '@/lib/operacoes/types';
import { errorMessage } from '@/hooks/useOperacoes';
import { Field, NativeSelect } from './shared';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const hojeExtenso = () => {
  const d = new Date();
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

const s = (v: unknown) => (v == null ? '' : String(v));

function dadosIniciais(carro: Carro): DeclaracaoDados {
  const [marca = '', ...resto] = s(carro.marca_modelo).split(/\s+/);
  return {
    nome: '',
    tipo_documento: 'Cartão de Cidadão',
    numero_documento: '',
    morada: '',
    matricula: s(carro.matricula),
    categoria: 'Ligeiro Passageiros',
    estado: 'USADO',
    ano: s(carro.ano),
    marca,
    modelo: resto.join(' '),
    combustivel: s(carro.combustivel),
    cor: s(carro.cor),
    cilindrada: '-',
    lotacao: '',
    chassis: '',
    data: hojeExtenso(),
  };
}

const CAMPOS: [keyof DeclaracaoDados, string, boolean?][] = [
  ['nome', 'Nome do comprador', true],
  ['tipo_documento', 'Documento de identificação'],
  ['numero_documento', 'Nº do documento'],
  ['morada', 'Morada', true],
  ['matricula', 'Matrícula'],
  ['categoria', 'Categoria'],
  ['estado', 'Estado'],
  ['ano', 'Ano'],
  ['marca', 'Marca'],
  ['modelo', 'Modelo'],
  ['combustivel', 'Combustível'],
  ['cor', 'Cor'],
  ['cilindrada', 'Cilindrada'],
  ['lotacao', 'Lotação'],
  ['chassis', 'Chassis'],
  ['data', 'Data da declaração', true],
];

/**
 * Cria a declaração de circulação de uma viatura vendida: escolhe-se o cliente (pasta em
 * Vendas/Pedidos Financiamento), lêem-se os documentos do cliente e da viatura, confirmam-se
 * os dados e o documento é criado na pasta da viatura na Drive.
 */
export function DeclaracaoCirculacao({
  carro,
  folderId,
  existente,
  onCreated,
}: {
  carro: Carro;
  folderId: string | undefined;
  existente?: DriveFile | null;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [dados, setDados] = useState<DeclaracaoDados>(() => dadosIniciais(carro));
  const [lendo, setLendo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [fontes, setFontes] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);

  const clientes = useQuery({
    queryKey: ['clientes-financiamento'],
    queryFn: listClientesFinanciamento,
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const set = (k: keyof DeclaracaoDados, v: string) => setDados((d) => ({ ...d, [k]: v }));

  async function lerDocumentos() {
    if (!clienteId) return toast.error('Escolha o cliente.');
    setLendo(true);
    setAvisos([]);
    setLink(null);
    try {
      const [c, v] = await Promise.allSettled([
        extrairDocumentos('cliente', clienteId),
        folderId ? extrairDocumentos('carro', folderId) : Promise.reject(new Error('Pasta da viatura não encontrada')),
      ]);
      const novosAvisos: string[] = [];
      const usadas: string[] = [];
      const merge: Partial<DeclaracaoDados> = {};
      const aplicar = (dd: Partial<Record<string, string>>) => {
        for (const [k, val] of Object.entries(dd)) {
          if (k in dados && val && k !== 'data') (merge as Record<string, string>)[k] = val;
        }
      };
      if (c.status === 'fulfilled') {
        aplicar(c.value.dados);
        usadas.push(...c.value.fontes);
        if (c.value.aviso) novosAvisos.push(`Cliente: ${c.value.aviso}`);
        if (c.value.dados.notas) novosAvisos.push(`Cliente: ${c.value.dados.notas}`);
      } else novosAvisos.push(`Cliente: ${errorMessage(c.reason)}`);
      if (v.status === 'fulfilled') {
        // A matrícula da ficha da viatura é a fonte certa; o resto vem dos documentos.
        const { matricula: _m, ...resto } = v.value.dados;
        aplicar(resto);
        usadas.push(...v.value.fontes);
        if (v.value.aviso) novosAvisos.push(`Viatura: ${v.value.aviso}`);
        if (v.value.dados.notas) novosAvisos.push(`Viatura: ${v.value.dados.notas}`);
      } else novosAvisos.push(`Viatura: ${errorMessage(v.reason)}`);
      setDados((d) => ({ ...d, ...merge }));
      setFontes(usadas);
      setAvisos(novosAvisos);
    } finally {
      setLendo(false);
    }
  }

  async function criar() {
    if (!folderId) return toast.error('Pasta da viatura na Drive não encontrada.');
    if (!dados.nome.trim()) return toast.error('Indique o nome do comprador.');
    setCriando(true);
    try {
      // Se já existia uma declaração, elimina-a antes de criar a nova (evita duplicados).
      if (existente) {
        await eliminarDeclaracao(existente.id);
      }
      const { file } = await criarDeclaracao(
        folderId,
        `Declaração de Circulação - ${dados.matricula || carro.matricula || ''}`.trim(),
        dados,
      );
      setLink(file.webViewLink);
      toast.success('Declaração criada na pasta da viatura');
      onCreated?.();
    } catch (e) {
      toast.error(`Erro ao criar: ${errorMessage(e)}`);
    } finally {
      setCriando(false);
    }
  }

  async function eliminar() {
    if (!existente) return;
    setCriando(true);
    try {
      await eliminarDeclaracao(existente.id);
      setLink(null);
      toast.success('Declaração eliminada');
      onCreated?.();
    } catch (e) {
      toast.error(`Erro ao eliminar: ${errorMessage(e)}`);
    } finally {
      setCriando(false);
    }
  }

  /** Abre o formulário para criar uma declaração nova, eliminando a atual se existir. */
  function criarOutro() {
    if (existente) {
      eliminar().then(() => {
        setDados(dadosIniciais(carro));
        setAvisos([]);
        setFontes([]);
        setOpen(true);
      });
      return;
    }
    setOpen(true);
  }

  if (!open) {
    if (existente) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={existente.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:underline"
            title={`${existente.name} — abrir na Drive`}
          >
            📄 Declaração de circulação
          </a>
          <Button type="button" variant="outline" size="sm" disabled={criando} onClick={eliminar}>
            {criando ? 'A eliminar…' : '🗑️ Eliminar'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={criarOutro}>
            ✍️ Criar outro
          </Button>
        </div>
      );
    }
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        📄 Declaração de circulação
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Declaração de circulação</div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          Fechar
        </button>
      </div>

      <Field label="Cliente (pasta em Vendas / Pedidos Financiamento)">
        <NativeSelect value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">
            {clientes.isLoading ? 'A carregar clientes…' : clientes.isError ? 'Erro ao ler a Drive' : 'Escolher cliente…'}
          </option>
          {(clientes.data || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {clientes.isError && (
        <p className="text-[11px] text-destructive">{errorMessage(clientes.error)}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={lendo || !clienteId} onClick={lerDocumentos}>
          {lendo ? 'A ler documentos…' : 'Ler dados dos documentos'}
        </Button>
        {!folderId && (
          <span className="text-[11px] text-destructive">Pasta da viatura na Drive não encontrada.</span>
        )}
      </div>

      {!!avisos.length && (
        <ul className="list-disc pl-4 text-[11px] text-amber-300">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {!!fontes.length && (
        <p className="text-[11px] text-muted-foreground">Lido de: {fontes.join(' · ')}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {CAMPOS.map(([k, label, wide]) => (
          <Field key={k} label={label} className={wide ? 'col-span-2' : undefined}>
            <Input value={dados[k]} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Confirme os dados lidos dos documentos antes de criar: o documento é gerado exatamente com o que está acima.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            Abrir documento criado ↗
          </a>
        )}
        <Button type="button" disabled={criando || !folderId} onClick={criar}>
          {criando ? 'A criar…' : 'Criar na pasta da viatura'}
        </Button>
      </div>
    </div>
  );
}
