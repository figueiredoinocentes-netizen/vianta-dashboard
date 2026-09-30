import { createContext, useContext } from 'react';

/** Estado partilhado entre as páginas da Operações e os seus pop-ups. */
export interface OpsContextValue {
  search: string;
  setSearch: (q: string) => void;
  openVehicle: (id: number) => void;
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
