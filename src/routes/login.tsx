import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import icon from "@/assets/logo-icon-v3.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signOut, user, rolesLoaded, hasRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user && rolesLoaded && hasRole("admin")) navigate({ to: "/admin" });
  }, [user, rolesLoaded, hasRole, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      console.log("👉 Iniciando tentativa de login com email:", email);
      const result = await signIn(email, password);
      console.log("👈 Resposta bruta do signIn:", result);
      
      const { error } = result;

      if (error) {
        console.error("🚨 ERRO DETALHADO RETORNADO PELO SUPABASE:");
        console.dir(error, { depth: null });
        console.error("Stringify do erro:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        let msg = "Falha ao entrar";
        if (error.message && error.message !== "{}") {
           msg = error.message;
        } else if (error.name) {
           msg = error.name;
        }
        
        if ((error as any).status) {
           msg += ` (Status: ${(error as any).status})`;
        }

        setErrorMsg(msg);
        toast.error(msg);
      } else {
        toast.success("Bem-vindo!");
      }
    } catch (err) {
      console.error("🚨 EXCEÇÃO NÃO TRATADA CAPTURADA NO CATCH:");
      console.dir(err, { depth: null });
      console.error("Stringify da exceção:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Erro Crítico: ${msg}`);
      toast.error(`Erro Crítico: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black">
            <img src={icon} alt="Primavera Delivery" className="h-12 w-12 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Primavera Delivery
          </span>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Painel Administrativo
        </p>
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
          Entrar na conta
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Acesso restrito para administradores.
        </p>

        {user && rolesLoaded && !hasRole("admin") ? (
          <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-foreground">
            <p className="font-semibold">Esta conta não tem acesso administrativo.</p>
            <p className="mt-2 text-muted-foreground">
              Saia e entre com uma conta administradora para acessar o painel.
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-95"
            >
              Sair da conta atual
            </button>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 w-full rounded-full border border-border bg-card px-5 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 w-full rounded-full border border-border bg-card px-5 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {errorMsg}
            </div>
          )}
        </form>
        )}
      </div>
    </div>
  );
}
