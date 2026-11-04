import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, PanelLeftOpen } from 'lucide-react';
import Sidebar from './Sidebar';
import viantaLogo from '@/assets/vianta-logo.jpeg';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const RECOLHIDO_KEY = 'vianta.sidebar.recolhido';

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [menuAberto, setMenuAberto] = useState(false);
  // Em ecrãs grandes o menu lateral pode ser recolhido; fica guardado neste browser.
  const [recolhido, setRecolhido] = useState(() => {
    try { return localStorage.getItem(RECOLHIDO_KEY) === '1'; } catch { return false; }
  });
  const { pathname } = useLocation();

  // Fecha o menu ao mudar de página (telemóvel).
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  const alternarRecolhido = (v: boolean) => {
    setRecolhido(v);
    try { localStorage.setItem(RECOLHIDO_KEY, v ? '1' : '0'); } catch { /* sem localStorage */ }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Barra superior — só em ecrãs pequenos */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-sidebar/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          className="-ml-1 rounded-md p-2 text-foreground hover:bg-sidebar-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <img src={viantaLogo} alt="" className="h-7 w-7 rounded-md object-contain" />
        <span className="font-display text-sm font-bold text-foreground">Vianta</span>
      </header>

      <Sidebar
        aberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
        recolhido={recolhido}
        onRecolher={() => alternarRecolhido(true)}
      />

      {/* Botão para voltar a mostrar o menu (ecrãs grandes, menu recolhido) */}
      {recolhido && (
        <button
          type="button"
          onClick={() => alternarRecolhido(false)}
          aria-label="Mostrar menu"
          title="Mostrar menu"
          className="fixed bottom-4 left-4 z-40 hidden items-center gap-2 rounded-lg border border-border bg-sidebar/95 px-3 py-2 text-xs font-medium text-sidebar-foreground shadow-lg backdrop-blur hover:text-foreground lg:flex"
        >
          <PanelLeftOpen className="h-4 w-4" />
          Menu
        </button>
      )}

      <main className={cn('min-h-screen transition-[margin] duration-200', recolhido ? 'lg:ml-0' : 'lg:ml-64')}>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
