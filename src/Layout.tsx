import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Filter, Calendar, Bot, Car, Settings } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/funil', label: 'Funil de Vendas', icon: Filter },
  { to: '/planeamento', label: 'Planeamento', icon: Calendar },
  { to: '/assistente', label: 'Assistente', icon: Bot },
  { to: '/operacoes', label: 'Operações', icon: Car },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

function Layout() {
  return (
    <div>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>VIANTA</h1>
          <p>Fleet Success Hub</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout