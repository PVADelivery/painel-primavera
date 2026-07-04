import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import icon from "@/assets/primavera-icon.png";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signOut, user, rolesLoaded, hasRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user && rolesLoaded && hasRole("admin")) navigate({ to: "/admin" });
  }, [user, rolesLoaded, hasRole, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Bem-vindo!");
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
        </form>
        )}
      </div>
    </div>
  );
}
