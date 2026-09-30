import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Marketing from "./pages/Marketing";
import SalesFunnel from "./pages/SalesFunnel";
import Assistant from "./pages/Assistant";
import Configuracoes from "./pages/Configuracoes";
import Planeamento from "./pages/Planeamento";
import Stock from "./pages/Stock";
import NotFound from "./pages/NotFound";
import OperacoesLayout from "./pages/operacoes/OperacoesLayout";
import OpsVisao from "./pages/operacoes/OpsVisao";
import OpsFrota from "./pages/operacoes/OpsFrota";
import OpsStock from "./pages/operacoes/OpsStock";
import OpsManutencao from "./pages/operacoes/OpsManutencao";
import OpsCheckin from "./pages/operacoes/OpsCheckin";
import OpsPagamentos from "./pages/operacoes/OpsPagamentos";
import OpsArmazem from "./pages/operacoes/OpsArmazem";
import OpsInvestidores from "./pages/operacoes/OpsInvestidores";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/funil" element={<SalesFunnel />} />
          <Route path="/planeamento" element={<Planeamento />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/assistente" element={<Assistant />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/operacoes" element={<OperacoesLayout />}>
            <Route index element={<OpsVisao />} />
            <Route path="frota" element={<OpsFrota />} />
            <Route path="stock" element={<OpsStock />} />
            <Route path="manutencao" element={<OpsManutencao />} />
            <Route path="checkin" element={<OpsCheckin />} />
            <Route path="pagamentos" element={<OpsPagamentos />} />
            <Route path="armazem" element={<OpsArmazem />} />
            <Route path="investidores" element={<OpsInvestidores />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
