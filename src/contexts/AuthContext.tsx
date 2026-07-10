import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "company" | "driver" | "customer";

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
  roles: AppRole[];
  profile: Profile | null;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchUserData = async (userId: string) => {
    // 1. Tenta buscar as roles usando a função segura (ignora RLS)
    const { data: rpcRoles, error: rpcError } = await supabase.rpc("get_my_roles");
    
    let userRoles: AppRole[] = [];

    if (!rpcError && rpcRoles) {
      // Se a função existir e rodar com sucesso, usamos o resultado dela.
      userRoles = rpcRoles.map((r: any) => r.role as AppRole);
    } else {
      // 2. FALLBACK SE A FUNÇÃO AINDA NÃO FOI CRIADA NO BANCO:
      // Faz as consultas normais como antes
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      
      userRoles = (rolesRes.data?.map((r) => r.role as AppRole)) ?? [];
      
      // Fallback antigo do profile (caso o user_roles esteja vazio)
      if (userRoles.length === 0 && profileRes.data?.role) {
        userRoles = [profileRes.data.role as AppRole];
      }
    }
    
    // ATUALIZA O PERFIL PARA OUTROS USOS DA APLICAÇÃO
    const profileRes = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();

    setRoles(userRoles);
    setProfile(profileRes.data ?? null);
    setRolesLoaded(true);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setRolesLoaded(false);
        setTimeout(() => fetchUserData(sess.user.id), 0);
      } else {
        setRoles([]);
        setProfile(null);
        setRolesLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchUserData(sess.user.id);
      else setRolesLoaded(true);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, loading, rolesLoaded, roles, profile, hasRole, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
