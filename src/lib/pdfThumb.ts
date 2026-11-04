// Miniaturas da 1.ª página de PDFs (pdf.js carregado só quando é preciso).
type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

// Um só worker do pdf.js para todas as miniaturas (criar um por PDF é muito lento).
let worker: InstanceType<PdfJs['PDFWorker']> | null = null;

const cache = new Map<string, Promise<string>>();

// No máximo 3 PDFs a renderizar ao mesmo tempo.
let ativos = 0;
const fila: (() => void)[] = [];
async function comVez<T>(fn: () => Promise<T>): Promise<T> {
  if (ativos >= 3) await new Promise<void>((r) => fila.push(r));
  ativos++;
  try {
    return await fn();
  } finally {
    ativos--;
    fila.shift()?.();
  }
}

/** Devolve um data URL (JPEG) da 1.ª página, com `largura` px. Resultado em cache por URL. */
export function miniaturaPdf(url: string, largura = 160): Promise<string> {
  const chave = `${url}|${largura}`;
  let p = cache.get(chave);
  if (!p) {
    p = comVez(async () => {
      const pdfjs = await loadPdfJs();
      if (!worker) worker = new pdfjs.PDFWorker({ name: 'faturas-miniaturas' });
      const doc = await pdfjs.getDocument({ url, worker }).promise;
      try {
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: largura / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
      } finally {
        doc.destroy();
      }
    });
    p.catch(() => cache.delete(chave));
    cache.set(chave, p);
  }
  return p;
}
