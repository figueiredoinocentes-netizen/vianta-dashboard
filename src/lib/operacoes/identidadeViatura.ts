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

export function marcasRegistadas(carros: Pick<Carro, 'marca' | 'marca_modelo'>[]) {
  return [...new Set(carros.map((c) => splitMarcaModelo(c).marca).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt'));
}
