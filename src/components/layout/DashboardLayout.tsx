import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import viantaLogo from '@/assets/vianta-logo.jpeg';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();

  // Fecha o menu ao mudar de página (telemóvel).
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

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

      <Sidebar aberto={menuAberto} onFechar={() => setMenuAberto(false)} />

      <main className="min-h-screen lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
