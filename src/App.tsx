import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppLayout } from "./components/app/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Upload from "./pages/app/Upload";
import Profile from "./pages/app/Profile";
import Clean from "./pages/app/Clean";
import Eda from "./pages/app/Eda";
import DashboardBuilder from "./pages/app/DashboardBuilder";
import Ml from "./pages/app/Ml";
import Reports from "./pages/app/Reports";
import Settings from "./pages/app/Settings";
import LegacyCleaner from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/legacy-cleaner" element={<LegacyCleaner />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/datasets/:id/profile" element={<Profile />} />
              <Route path="/datasets/:id/clean" element={<Clean />} />
              <Route path="/datasets/:id/eda" element={<Eda />} />
              <Route path="/datasets/:id/dashboard" element={<DashboardBuilder />} />
              <Route path="/datasets/:id/ml" element={<Ml />} />
              <Route path="/datasets/:id/reports" element={<Reports />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
