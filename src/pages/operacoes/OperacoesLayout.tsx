import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { OpsContext, type OpsContextValue } from '@/components/operacoes/OpsContext';
import { NovaViaturaDialog } from '@/components/operacoes/NovaViaturaDialog';
import { NovoItemDialog } from '@/components/operacoes/NovoItemDialog';
import { InvestidorDialog } from '@/components/operacoes/InvestidorDialog';
import { VehicleDetailDialog } from '@/components/operacoes/VehicleDetailDialog';

/**
 * Casca da área Operações: um único layout, a pesquisa global partilhada entre
 * secções e os pop-ups (que qualquer secção pode abrir através do contexto).
 */
export default function OperacoesLayout() {
  const [search, setSearch] = useState('');
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [novaViatura, setNovaViatura] = useState(false);
  const [novoItem, setNovoItem] = useState(false);
  const [investidor, setInvestidor] = useState<{ open: boolean; id?: number }>({ open: false });

  const ctx = useMemo<OpsContextValue>(
    () => ({
      search,
      setSearch,
      openVehicle: setVehicleId,
      openNovaViatura: () => setNovaViatura(true),
      openNovoItem: () => setNovoItem(true),
      openInvestidor: (id) => setInvestidor({ open: true, id }),
    }),
    [search],
  );

  return (
    <OpsContext.Provider value={ctx}>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
      <VehicleDetailDialog carId={vehicleId} onClose={() => setVehicleId(null)} />
      <NovaViaturaDialog open={novaViatura} onOpenChange={setNovaViatura} />
      <NovoItemDialog open={novoItem} onOpenChange={setNovoItem} />
      <InvestidorDialog
        open={investidor.open}
        id={investidor.id}
        onOpenChange={(open) => setInvestidor((s) => ({ ...s, open }))}
      />
    </OpsContext.Provider>
  );
}
