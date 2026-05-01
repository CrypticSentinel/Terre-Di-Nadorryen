import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, User as UserIcon, Mail } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const profileSchema = z
  .object({
    name: z.string().trim().min(2, "Il nome deve contenere almeno 2 caratteri."),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      const newPassword = data.newPassword?.trim() || "";
      const confirmPassword = data.confirmPassword?.trim() || "";
      if (!newPassword && !confirmPassword) return true;
      return newPassword.length >= 8;
    },
    {
      path: ["newPassword"],
      message: "La nuova password deve contenere almeno 8 caratteri.",
    }
  )
  .refine(
    (data) => {
      const newPassword = data.newPassword?.trim() || "";
      const confirmPassword = data.confirmPassword?.trim() || "";
      if (!newPassword && !confirmPassword) return true;
      return newPassword === confirmPassword;
    },
    {
      path: ["confirmPassword"],
      message: "La conferma password non corrisponde.",
    }
  );

type ProfileValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error(error.message);
      } else {
        form.setValue("name", data?.display_name ?? "");
      }

      setLoading(false);
    };

    load();
  }, [user, form]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error("Utente non autenticato.");
      return;
    }

    const name = form.getValues("name").trim();

    setSavingName(true);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);

    setSavingName(false);

    if (error) toast.error(error.message);
    else toast.success("Nome aggiornato con successo.");
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error("Utente non autenticato.");
      return;
    }

    const result = profileSchema.safeParse(form.getValues());
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Controlla i campi della password.");
      return;
    }

    const newPassword = result.data.newPassword?.trim() || "";
    const confirmPassword = result.data.confirmPassword?.trim() || "";

    if (!newPassword || !confirmPassword) {
      toast.error("Inserisci e conferma la nuova password.");
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    form.setValue("newPassword", "");
    form.setValue("confirmPassword", "");
    toast.success("Password aggiornata con successo.");
  };

  return (
    <div className="min-h-screen">
      <main className="container py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-1 font-display text-4xl gold-text">Profilo utente</h1>
            <p className="font-script italic text-ink-faded">
              Gestisci nome visualizzato, e-mail e password del tuo account
            </p>
          </div>
        </div>

        <div className="parchment-panel mb-6 flex items-center gap-2 p-3 text-sm font-script italic text-ink-faded">
          <UserIcon className="h-4 w-4 text-primary" />
          Qui puoi aggiornare il profilo del tuo personaggio digitale.
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="parchment-panel p-6">
            <div className="mb-5 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-2xl">E-mail</h2>
            </div>

            <p className="mb-4 font-script text-sm text-ink-faded">
              L’indirizzo e-mail del tuo account non è modificabile.
            </p>

            <Input value={user?.email ?? ""} disabled />
          </section>

          <section className="parchment-panel p-6">
            <div className="mb-5 flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-2xl">Nome visualizzato</h2>
            </div>

            <p className="mb-4 font-script text-sm text-ink-faded">
              Aggiorna il nome che gli altri vedono associato al tuo account.
            </p>

            <form onSubmit={saveName} className="space-y-4">
              <div>
                <Label htmlFor="name" className="font-heading">
                  Nome
                </Label>
                <Input
                  id="name"
                  value={form.watch("name")}
                  onChange={(e) => form.setValue("name", e.target.value)}
                  placeholder="Inserisci il tuo nome"
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={savingName} className="font-heading">
                {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserIcon className="mr-2 h-4 w-4" />}
                Salva nome
              </Button>
            </form>
          </section>
        </div>

        <section className="parchment-panel mt-5 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-2xl">Password</h2>
          </div>

          <p className="mb-4 font-script text-sm text-ink-faded">
            Scegli una nuova password per proteggere il tuo account.
          </p>

          <form onSubmit={savePassword} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="newPassword" className="font-heading">
                Nuova password
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={form.watch("newPassword")}
                onChange={(e) => form.setValue("newPassword", e.target.value)}
                placeholder="Inserisci la nuova password"
              />
              {form.formState.errors.newPassword && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="font-heading">
                Conferma password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.watch("confirmPassword")}
                onChange={(e) => form.setValue("confirmPassword", e.target.value)}
                placeholder="Conferma la nuova password"
              />
              {form.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={savingPassword} className="font-heading">
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Salva password
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}