import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Database } from "lucide-react";

export const Route = createFileRoute("/admin/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, signOut } = useAuth();
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
      </div>
      <Card className="max-w-lg p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {profile?.full_name?.charAt(0) || "A"}
          </div>
          <div>
            <p className="font-semibold text-lg">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button onClick={signOut} variant="outline" className="mt-6 w-full">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </Card>

      <Card className="max-w-lg p-6 shadow-card mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Conexão com o Banco de Dados</h2>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">URL do Supabase conectado:</p>
          <code className="block break-all rounded-lg bg-muted px-3 py-2 text-sm font-mono text-foreground">
            {import.meta.env.VITE_SUPABASE_URL || "Não configurado"}
          </code>
        </div>
      </Card>
    </AdminLayout>
  );
}
