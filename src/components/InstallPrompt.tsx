import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isInStandaloneMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const showIosHint = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isIos() && !isInStandaloneMode() && !dismissed;
  }, [dismissed]);

  const showInstallButton = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !isIos() && !isInStandaloneMode() && !!deferredPrompt && !dismissed;
  }, [deferredPrompt, dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setDismissed(true);
  };

  if (!showIosHint && !showInstallButton) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:w-[360px]">
      <div className="rounded-2xl border border-border60 bg-parchment-deep90/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-heading text-sm text-ink">Installa l'app</div>
            {showInstallButton ? (
              <p className="mt-1 text-sm text-ink-faded">
                Aggiungi Terre di Nadorryen alla schermata Home per aprirla come un'app.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-faded">
                Su iPhone: tocca Condividi e poi “Aggiungi alla schermata Home”.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md px-2 py-1 text-sm text-ink-faded transition hover:bg-background/40 hover:text-ink"
            aria-label="Chiudi suggerimento installazione"
          >
            ✕
          </button>
        </div>

        {showInstallButton && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-heading text-white transition hover:opacity-90"
            >
              Installa app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
