import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-black">Perfil</h1>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary text-2xl font-black">
            {(profile?.full_name || user?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold">{profile?.full_name || "Usuário"}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
