import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Filter,
  BarChart2,
  RefreshCw,
  Layers,
  Receipt,
  ChartNoAxesCombined,
  Settings,
  Gauge,
  Car,
  Store,
  Wrench,
  ClipboardCheck,
  Wallet,
  Package,
  Handshake,
  Bot,
  PanelLeftClose,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import viantaLogo from '@/assets/vianta-logo.jpeg';

const aquisicaoItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/funil', label: 'Funil de Vendas', icon: Filter },
  { to: '/planeamento', label: 'Planeamento', icon: BarChart2 },
  { to: '/stock', label: 'Stock', icon: Layers },
];

const operacoesItems = [
  { to: '/operacoes', label: 'Visão Geral', icon: Gauge, end: true },
  { to: '/operacoes/frota', label: 'Frota Ativa', icon: Car },
  { to: '/operacoes/stock', label: 'Stock', icon: Store },
  { to: '/operacoes/manutencao', label: 'Manutenções', icon: Wrench },
  { to: '/operacoes/checkin', label: 'Check-ins', icon: ClipboardCheck },
  { to: '/operacoes/pagamentos', label: 'Pagamentos', icon: Wallet },
  { to: '/operacoes/armazem', label: 'Armazém', icon: Package },
  { to: '/operacoes/investidores', label: 'Investidores', icon: Handshake },
];

const financeiroItems = [
  { to: '/financeiro', label: 'Faturas de Custos', icon: Receipt, end: true },
  { to: '/financeiro/pl', label: 'P&L', icon: ChartNoAxesCombined },
];

const settingsItem = { to: '/configuracoes', label: 'Configurações', icon: Settings };
const aiosItem = { to: '/aios', label: 'AI OS', icon: Bot };

const linkClass = (isActive: boolean) =>
  cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-primary/10 text-primary glow-primary'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  );

interface SidebarProps {
  /** Só relevante em ecrãs pequenos: a barra lateral abre como gaveta. */
  aberto?: boolean;
  onFechar?: () => void;
  /** Ecrãs grandes: menu escondido para a página ocupar o ecrã todo. */
  recolhido?: boolean;
  onRecolher?: () => void;
}

const Sidebar = ({ aberto = false, onFechar, recolhido = false, onRecolher }: SidebarProps) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const emOperacoes = location.pathname.startsWith('/operacoes');
  const emFinanceiro = location.pathname.startsWith('/financeiro');
  const items = emOperacoes ? operacoesItems : emFinanceiro ? financeiroItems : aquisicaoItems;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sheet-data'] }),
      queryClient.invalidateQueries({ queryKey: ['central'] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <>
    {/* Fundo escurecido atrás da gaveta (telemóvel) */}
    {aberto && (
      <div
        className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        onClick={onFechar}
        aria-hidden="true"
      />
    )}
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-[100dvh] w-64 max-w-[85vw] border-r border-border bg-sidebar flex flex-col transition-transform duration-200 lg:z-40',
        aberto ? 'translate-x-0' : '-translate-x-full',
        recolhido ? 'lg:-translate-x-full' : 'lg:translate-x-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
        <img src={viantaLogo} alt="Vianta logo" className="h-9 w-9 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-sm text-foreground">Vianta</h1>
          <p className="text-[10px] text-muted-foreground">
            {emOperacoes ? 'Central · Gestão de Frota' : emFinanceiro ? 'Financeiro · Custos' : 'Marketing & Comercial'}
          </p>
        </div>
        {onRecolher && (
          <button
            type="button"
            onClick={onRecolher}
            aria-label="Recolher menu"
            title="Recolher menu"
            className="-mr-2 hidden rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:block"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Vendas / Operações */}
      <div className="px-3 pt-3">
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {[
            { to: '/', label: 'Vendas', active: !emOperacoes && !emFinanceiro },
            { to: '/operacoes', label: 'Operações', active: emOperacoes },
            { to: '/financeiro', label: 'Financeiro', active: emFinanceiro },
          ].map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                'flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors',
                tab.active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) => linkClass(isActive)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <NavLink to={aiosItem.to} className={({ isActive }) => linkClass(isActive)}>
          <aiosItem.icon className="h-4 w-4" />
          {aiosItem.label}
        </NavLink>
        <NavLink to={settingsItem.to} className={({ isActive }) => linkClass(isActive)}>
          <settingsItem.icon className="h-4 w-4" />
          {settingsItem.label}
        </NavLink>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 w-full disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'A atualizar...' : 'Atualizar Dados'}
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
