import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

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
    </AdminLayout>
  );
}
