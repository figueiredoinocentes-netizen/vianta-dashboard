import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { faturaUrl } from '@/lib/operacoes/central';
import { miniaturaPdf } from '@/lib/pdfThumb';
import { ePdf } from '@/lib/financeiro';
import { cn } from '@/lib/utils';

/** Miniatura da 1.ª página (carrega só quando aparece no ecrã). */
export function FaturaThumb({
  path,
  nome,
  onClick,
  className,
}: {
  path: string;
  nome?: string | null;
  onClick?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const url = faturaUrl(path);
  const pdf = ePdf(nome || path);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    if (!pdf) return setSrc(url);
    let vivo = true;
    miniaturaPdf(url)
      .then((d) => vivo && setSrc(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [visivel, pdf, url]);

  return (
    <button
      ref={ref}
      type="button"
      title={`Ver ${nome || 'fatura'}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'group relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-white/5 transition hover:border-primary hover:ring-2 hover:ring-primary/40',
        className,
      )}
    >
      {src && !erro ? (
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <FileText className={cn('h-5 w-5 text-muted-foreground', !erro && visivel && 'animate-pulse')} />
      )}
    </button>
  );
}

/** Visualizador grande (PDF com zoom do browser, ou imagem). */
export function FaturaViewer({
  path,
  nome,
  titulo,
  onClose,
}: {
  path: string | null;
  nome?: string | null;
  titulo?: string;
  onClose: () => void;
}) {
  const url = path ? faturaUrl(path) : '';
  return (
    <Dialog open={!!path} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col gap-3 p-4" aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
          <DialogTitle className="truncate text-base">{titulo || nome || 'Fatura'}</DialogTitle>
          {path && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir noutro separador
            </a>
          )}
        </DialogHeader>
        {path && <FaturaEmbed src={url} pdf={ePdf(nome || path)} className="flex-1" />}
      </DialogContent>
    </Dialog>
  );
}

/** O ficheiro embebido (iframe para PDF, img para imagens). */
export function FaturaEmbed({ src, pdf, className }: { src: string; pdf: boolean; className?: string }) {
  return pdf ? (
    <iframe src={src} title="Fatura" className={cn('w-full rounded-md border border-border bg-white', className)} />
  ) : (
    <div className={cn('flex items-center justify-center overflow-auto rounded-md border border-border bg-black/40', className)}>
      <img src={src} alt="Fatura" className="max-h-full max-w-full object-contain" />
    </div>
  );
}
