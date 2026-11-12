import { createContext, useContext } from 'react';

/** Separadores do pop-up da viatura. */
export type VehicleTab = 'carac' | 'ficha' | 'prep' | 'sinist' | 'historico';

/** Estado partilhado entre as páginas da Operações e os seus pop-ups. */
export interface OpsContextValue {
  search: string;
  setSearch: (q: string) => void;
  /** Abre a ficha da viatura; `tab` abre-a diretamente num separador. */
  openVehicle: (id: number, tab?: VehicleTab) => void;
  openNovaViatura: () => void;
  openNovoItem: () => void;
  openInvestidor: (id?: number) => void;
}

export const OpsContext = createContext<OpsContextValue | null>(null);

export function useOps(): OpsContextValue {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps tem de ser usado dentro de OperacoesLayout');
  return ctx;
}
