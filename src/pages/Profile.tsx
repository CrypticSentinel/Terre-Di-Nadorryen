import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, User as UserIcon, Mail } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve contenere almeno 2 caratteri."),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user } = useAuth();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const initialValues = useMemo<ProfileValues>(
    () => ({
      name: "",
      newPassword: "",
      confirmPassword: "",
    }),
    []
  );

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setError(error.message);
        return;
      }

      form.setValue("name", data?.display_name ?? "");
    };

    loadProfile();
  }, [user, form]);

  const saveName = async () => {
    setError(null);
    setMessage(null);
    setSavingName(true);

    try {
      if (!user?.id) {
        setError("Utente non autenticato.");
        return;
      }

      const name = form.getValues("name").trim();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", user.id);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setMessage("Nome aggiornato con successo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto durante il salvataggio del nome.");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    setError(null);
    setMessage(null);
    setSavingPassword(true);

    try {
      const newPassword = form.getValues("newPassword")?.trim() || "";
      const confirmPassword = form.getValues("confirmPassword")?.trim() || "";

      if (newPassword.length < 8) {
        setError("La nuova password deve contenere almeno 8 caratteri.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("La conferma password non corrisponde.");
        return;
      }

      setError("La modifica password va gestita con il flusso auth del progetto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto durante il salvataggio della password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl">Profilo utente</h1>
        <p className="text-muted-foreground">
          Gestisci il tuo nome visualizzato e la password dell’account.
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted/30 text-foreground"
          }`}
        >
          {error || message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-mail
          </CardTitle>
          <CardDescription>
            L’indirizzo e-mail del tuo account non è modificabile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input value={user?.email ?? ""} disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Nome
          </CardTitle>
          <CardDescription>
            Aggiorna il nome visualizzato associato al tuo account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={saveName} disabled={savingName}>
                {savingName ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserIcon className="mr-2 h-4 w-4" />
                )}
                Salva nome
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            Aggiorna la password del tuo account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Inserisci la nuova password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conferma nuova password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Conferma la nuova password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={savePassword} disabled={savingPassword}>
                {savingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Salva password
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}