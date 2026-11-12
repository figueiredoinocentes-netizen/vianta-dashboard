import type { Carro } from './types';

// Marcas observadas nos registos atuais, usadas apenas para separar dados legados.
const MARCAS_CONHECIDAS = [
  'Mercedes-Benz', 'Citroen', 'Cupra', 'Dacia', 'Fiat', 'Hyundai', 'Kia', 'MG',
  'Opel', 'Peugeot', 'Polestar', 'Renault', 'Seat', 'Seres', 'Tesla', 'Volvo',
  'BYD', 'VW',
];

export function splitMarcaModelo(carro: Pick<Carro, 'marca' | 'marca_modelo'>) {
  const marca = (carro.marca || '').trim();
  const modelo = (carro.marca_modelo || '').trim();
  if (marca) return { marca, modelo };

  const marcaLegada = MARCAS_CONHECIDAS.find((m) =>
    modelo.toLocaleLowerCase() === m.toLocaleLowerCase() ||
    modelo.toLocaleLowerCase().startsWith(m.toLocaleLowerCase() + ' '),
  );
  if (marcaLegada && modelo.toLocaleLowerCase() === marcaLegada.toLocaleLowerCase()) {
    return { marca: marcaLegada, modelo: '' };
  }
  if (/^MG[45]$/i.test(modelo)) return { marca: 'MG', modelo: modelo.slice(2) };
  return marcaLegada
    ? { marca: marcaLegada, modelo: modelo.slice(marcaLegada.length).trim() }
    : { marca: '', modelo };
}

export function nomeCarro(carro: Pick<Carro, 'marca' | 'marca_modelo' | 'versao'>) {
  const identidade = nomeCarroPartes(carro);
  return [identidade.marca, identidade.modelo, identidade.versao]
    .filter(Boolean)
    .join(' ');
}

/** Se a versão já estiver repetida no fim do modelo legado, remove-a só na apresentação. */
export function nomeCarroPartes(carro: Pick<Carro, 'marca' | 'marca_modelo' | 'versao'>) {
  const { marca, modelo: modeloOriginal } = splitMarcaModelo(carro);
  const versao = carro.versao?.trim() || '';
  const duplicada = versao && modeloOriginal.toLocaleLowerCase().endsWith(` ${versao}`.toLocaleLowerCase());
  const modelo = duplicada ? modeloOriginal.slice(0, -(versao.length + 1)).trim() : modeloOriginal;
  return { marca, modelo, versao };
}

export function marcasRegistadas(carros: Pick<Carro, 'marca' | 'marca_modelo'>[]) {
  return [...new Set(carros.map((c) => splitMarcaModelo(c).marca).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt'));
}
