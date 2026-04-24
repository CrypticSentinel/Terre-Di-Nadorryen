import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { Hourglass, LogOut, RefreshCw, ShieldX } from "lucide-react";

const PendingApproval = () => {
  const { user, loading, approvalStatus, isApproved, signOut, refreshApprovalStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
    if (!loading && isApproved) navigate("/campaigns", { replace: true });
  }, [user, loading, isApproved, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isRejected = approvalStatus === "rejected";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container py-12 md:py-20 flex items-center justify-center">
        <div className="w-full max-w-lg parchment-panel p-8 text-center">
          {isRejected ? (
            <>
              <ShieldX className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h1 className="font-display text-3xl gold-text mb-3">Accesso negato</h1>
              <p className="font-script italic text-ink-faded mb-6">
                Il cronista ha respinto la tua richiesta di unirti alle Terre di Nadorryen.
              </p>
            </>
          ) : (
            <>
              <Hourglass className="h-16 w-16 text-primary mx-auto mb-4 animate-flicker" />
              <h1 className="font-display text-3xl gold-text mb-3">In attesa del cronista</h1>
              <p className="font-script italic text-ink-faded mb-6">
                Il tuo nome è stato iscritto, ma il cronista deve ancora approvare il tuo ingresso nelle Terre di Nadorryen.
              </p>
              <p className="text-sm text-ink-faded mb-6">
                Riceverai accesso non appena un amministratore approverà la tua richiesta.
              </p>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isRejected && (
              <Button onClick={refreshApprovalStatus} variant="default" className="font-heading">
                <RefreshCw className="h-4 w-4 mr-2" />
                Verifica di nuovo
              </Button>
            )}
            <Button onClick={handleSignOut} variant="outline" className="font-heading">
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
