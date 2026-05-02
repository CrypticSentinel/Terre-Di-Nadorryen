import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UiTextProvider } from "@/hooks/useUiText";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CharacterDetail from "./pages/CharacterDetail";
import PendingApproval from "./pages/PendingApproval";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

import { InstallPrompt } from "@/components/InstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <UiTextProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pending-approval" element={<PendingApproval />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
                    <Route path="/characters/:characterId" element={<CharacterDetail />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>
                </Route>

                <Route path="/groups" element={<Navigate to="/campaigns" replace />} />
                <Route path="/groups/:groupId" element={<Navigate to="/campaigns" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>

              <InstallPrompt />
            </UiTextProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
