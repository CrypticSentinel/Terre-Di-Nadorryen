import { Outlet } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { CampaignDiceNotifications } from "@/components/CampaignDiceNotifications";

/**
 * Layout condiviso per le route autenticate: header + contenuto della route.
 */
export const AppShell = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <CampaignDiceNotifications />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
