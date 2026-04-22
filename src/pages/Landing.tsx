import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero-fantasy.jpg";
import { ScrollText, Users, Dices, BookMarked } from "lucide-react";

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Avventuriero incappucciato che osserva un tramonto su antiche rovine"
            className="w-full h-full object-cover"
            width={1536}
            height={1024}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-parchment via-parchment/70 to-parchment/30" />
          <div className="absolute inset-0 bg-vignette" />
        </div>

        <div className="relative container py-24 md:py-36 text-center">
          <p className="font-script italic text-ink-faded mb-4 animate-fade-up">~ Capitolo Primo ~</p>
          <h1 className="font-display text-5xl md:text-7xl gold-text mb-6 animate-fade-up text-shadow-emboss">
            Codex of Heroes
          </h1>
          <p className="font-script text-lg md:text-2xl max-w-2xl mx-auto text-ink-faded mb-10 animate-fade-up">
            Custodisci le schede dei tuoi eroi, condividile con il tuo gruppo, e che le sorti dei dadi
            ti siano sempre favorevoli.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-up">
            <Link to={user ? "/groups" : "/auth"}>
              <Button size="lg" className="font-heading text-base px-8 shadow-glow">
                <ScrollText className="mr-2 h-5 w-5" />
                {user ? "Vai ai tuoi gruppi" : "Apri il Codice"}
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="font-heading text-base px-8">
                Scopri di più
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="ornament-divider mb-4">
          <span className="font-display text-2xl">✦</span>
        </div>
        <h2 className="font-heading text-3xl md:text-4xl text-center mb-3">Le arti del cronista</h2>
        <p className="text-center text-ink-faded font-script italic mb-14 max-w-xl mx-auto">
          Tutto ciò che serve per dare vita ai tuoi personaggi e alla tua compagnia.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: ScrollText, title: "Schede personalizzabili", desc: "Crea schede con i campi che vuoi tu, adatte a qualsiasi sistema di gioco." },
            { icon: Users, title: "Gruppi condivisi", desc: "Invita master e giocatori con un codice. Le schede sono visibili a tutta la compagnia." },
            { icon: Dices, title: "Tiri di dado", desc: "Lancia d4, d6, d8, d10, d12, d20 e d100 con un clic, dalla tua scheda." },
            { icon: BookMarked, title: "Diario di campagna", desc: "Annota le imprese e i ricordi sessione dopo sessione, accanto al tuo eroe." },
          ].map((f, i) => (
            <div key={i} className="parchment-panel p-6 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-heading text-lg mb-2">{f.title}</h3>
              <p className="font-script text-sm text-ink-faded leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="container py-10 text-center font-script italic text-ink-faded text-sm">
        ⚔ Possa il tuo prossimo tiro essere un naturale 20 ⚔
      </footer>
    </div>
  );
};

export default Landing;
