import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";
import { ScrollText, Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isApproved, approvalStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    if (isApproved) {
      navigate("/campaigns", { replace: true });
    } else if (approvalStatus) {
      navigate("/pending-approval", { replace: true });
    }
  }, [user, authLoading, isApproved, approvalStatus, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenziali non valide" : error.message);
    } else {
      toast.success("Bentornato, avventuriero!");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/pending-approval`,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already") ? "Questo indirizzo è già registrato" : error.message);
    } else {
      toast.success("Iscrizione ricevuta! Attendi l'approvazione del cronista.");
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container py-12 md:py-20 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <ScrollText className="h-12 w-12 text-primary mx-auto mb-3 animate-flicker" />
            <h1 className="font-display text-3xl gold-text mb-2">La sala del cronista</h1>
            <p className="font-script italic text-ink-faded">Iscrivi il tuo nome o riprendi l'avventura</p>
          </div>

          <div className="parchment-panel p-8">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-parchment-deep/40">
                <TabsTrigger value="signin" className="font-heading">Accedi</TabsTrigger>
                <TabsTrigger value="signup" className="font-heading">Iscriviti</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="email-in" className="font-heading">Email</Label>
                    <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pwd-in" className="font-heading">Parola d'ordine</Label>
                    <Input id="pwd-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full font-heading" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entra nella sala"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="name-up" className="font-heading">Nome del cronista</Label>
                    <Input id="name-up" type="text" placeholder="Es. Eldoran il Saggio" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="email-up" className="font-heading">Email</Label>
                    <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pwd-up" className="font-heading">Parola d'ordine</Label>
                    <Input id="pwd-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full font-heading" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iscrivi il mio nome"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
