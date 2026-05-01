import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve contenere almeno 2 caratteri."),
  email: z.string().trim().email("Inserisci un indirizzo e-mail valido."),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const initialValues = useMemo<ProfileValues>(() => ({
    name: "",
    email: String(user?.email || ""),
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  }), [user]);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  useEffect(() => {
    const loadDisplayName = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data?.display_name) {
        form.setValue("name", data.display_name);
      }
    };

    loadDisplayName();
  }, [user, form]);

  const saveName = async () => {
    setError(null);
    setMessage(null);
    setSavingName(true);

    const name = form.getValues("name").trim();
    const { error } = await supabase.auth.update({
      data: { full_name: name, display_name: name },
    });

    if (!error && user?.id) {
      await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", user.id);
    }

    setSavingName(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Nome aggiornato con successo.");
  };

  const saveEmail = async () => {
    setError(null);
    setMessage(null);
    setSavingEmail(true);

    const email = form.getValues("email").trim();
    const { error } = await supabase.auth.update({
      email,
    });

    setSavingEmail(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Richiesta di cambio e-mail inviata. Controlla la posta per confermare.");
  };

  const savePassword = async () => {
    setError(null);
    setMessage(null);
    setSavingPassword(true);

    const newPassword = form.getValues("newPassword")?.trim() || "";
    const confirmPassword = form.getValues("confirmPassword")?.trim() || "";

    if (newPassword.length < 8) {
      setSavingPassword(false);
      setError("La nuova password deve contenere almeno 8 caratteri.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSavingPassword(false);
      setError("La conferma password non corrisponde.");
      return;
    }

    const { error } = await supabase.auth.update({
      password: newPassword,
    });

    setSavingPassword(false);

    if (error) {
      setError(error.message);
      return;
    }

    form.setValue("currentPassword", "");
    form.setValue("newPassword", "");
    form.setValue("confirmPassword", "");
    setMessage("Password aggiornata con successo.");
  };

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl">Profilo utente</h1>
        <p className="text-muted-foreground">Gestisci i dati del tuo account personale.</p>
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
                      <Input {...field} placeholder="Inserisci il tuo nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={saveName} disabled={savingName}>
                {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserIcon className="mr-2 h-4 w-4" />}
                Salva nome
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-mail
          </CardTitle>
          <CardDescription>
            Modifica l’indirizzo e-mail usato per accedere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="nome@esempio.it" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" onClick={saveEmail} disabled={savingEmail}>
                {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Salva e-mail
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
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Salva password
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}