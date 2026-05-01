import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, User as UserIcon, ShieldCheck } from "lucide-react";

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

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const loadProfile = async () => {
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
        toast.error("Impossibile caricare il profilo");
      } else {
        form.setValue("name", data?.display_name ?? "");
      }

      setLoading(false);
    };

    loadProfile();
  }, [user, form]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.getValues("name").trim();

    if (name.length < 2) {
      form.setError("name", {
        type: "manual",
        message: "Il nome deve contenere almeno 2 caratteri.",
      });
      return;
    }

    setSavingName(true);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);

    setSavingName(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Nome aggiornato con successo.");
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = profileSchema.safeParse(form.getValues());

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      if (firstIssue?.path?.[0]) {
        form.setError(firstIssue.path[0] as keyof ProfileValues, {
          type: "manual",
          message: firstIssue.message,
        });
      }
      toast.error(firstIssue?.message ?? "Controlla i campi della password.");
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
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 font-display text-4xl gold-text">
            <UserIcon className="h-8 w-8" />
            Profilo utente
          </h1>
          <p className="font-script italic text-ink-faded">
            Custodisci il tuo nome, la tua e-mail e la chiave d’accesso alle Terre di Nadorryen
          </p>
        </div>

        <div className="parchment-panel mb-8 flex items-center gap-2 p-3 text-sm font-script italic text-ink-faded">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Da questa pagina puoi aggiornare le informazioni essenziali del tuo account.
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 font-heading text-2xl">
                <Mail className="h-5 w-5 text-primary" />
                Identità dell’account
              </h2>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="parchment-panel p-5 md:p-6">
                  <div className="mb-4">
                    <h3 className="font-heading text-lg">E-mail</h3>
                    <p className="font-script text-sm italic text-ink-faded">
                      L’indirizzo associato al tuo accesso non può essere modificato da qui.
                    </p>
                  </div>

                  <Input value={user.email ?? ""} disabled />
                </div>

                <div className="parchment-panel p-5 md:p-6">
                  <div className="mb-4">
                    <h3 className="font-heading text-lg">Nome visualizzato</h3>
                    <p className="font-script text-sm italic text-ink-faded">
                      È il nome con cui comparirai nelle cronache e nelle sezioni condivise.
                    </p>
                  </div>

                  <form onSubmit={saveName} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="font-heading">
                        Nome
                      </Label>
                      <Input
                        id="name"
                        value={form.watch("name")}
                        onChange={(e) => {
                          form.clearErrors("name");
                          form.setValue("name", e.target.value, { shouldValidate: false });
                        }}
                        placeholder="Inserisci il tuo nome"
                      />
                      {form.formState.errors.name && (
                        <p className="mt-1 text-sm text-destructive">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <Button type="submit" disabled={savingName} className="w-full sm:w-auto font-heading">
                      {savingName ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserIcon className="mr-2 h-4 w-4" />
                      )}
                      Salva nome
                    </Button>
                  </form>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 font-heading text-2xl">
                <Lock className="h-5 w-5 text-primary" />
                Sicurezza
              </h2>

              <div className="parchment-panel p-5 md:p-6">
                <div className="mb-4">
                  <h3 className="font-heading text-lg">Cambia password</h3>
                  <p className="font-script text-sm italic text-ink-faded">
                    Scegli una nuova chiave d’accesso per proteggere il tuo account.
                  </p>
                </div>

                <form onSubmit={savePassword} className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="newPassword" className="font-heading">
                      Nuova password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={form.watch("newPassword")}
                      onChange={(e) => {
                        form.clearErrors("newPassword");
                        form.setValue("newPassword", e.target.value, { shouldValidate: false });
                      }}
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
                      onChange={(e) => {
                        form.clearErrors("confirmPassword");
                        form.setValue("confirmPassword", e.target.value, { shouldValidate: false });
                      }}
                      placeholder="Conferma la nuova password"
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="mt-1 text-sm text-destructive">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Button type="submit" disabled={savingPassword} className="w-full sm:w-auto font-heading">
                      {savingPassword ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      Salva password
                    </Button>
                  </div>
                </form>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;