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
  const { signIn, signUp, user, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (user && rolesLoaded) navigate({ to: "/app" });
  }, [user, rolesLoaded, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) toast.error(error.message);
      else toast.success("Bem-vindo!");
    } else {
      const { error } = await signUp(email, password, fullName);
      setLoading(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Conta criada! Você já pode entrar.");
        setMode("signin");
      }
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black">
            <img src={icon} alt="Delivery Primavera" className="h-12 w-12 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Delivery <span className="text-foreground">Primavera</span>
          </span>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Painel do Lojista
        </p>
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
          {isSignup ? "Criar conta" : "Entrar na conta"}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {isSignup ? "Comece em poucos segundos." : "Bom te ver de novo."}
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          {isSignup && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Nome completo
              </label>
              <input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-14 w-full rounded-full border border-border bg-card px-5 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

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
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isSignup ? (
              "Criar conta"
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <div className="mt-8 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isSignup ? "signin" : "signup")}
              className="font-bold text-primary hover:underline"
            >
              {isSignup ? "Entrar" : "Criar uma"}
            </button>
          </p>
          <a href="#" className="block text-sm text-muted-foreground hover:text-foreground">
            Acesso de lojista parceiro →
          </a>
        </div>
      </div>
    </div>
  );
}
