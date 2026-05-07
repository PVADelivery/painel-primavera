import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">Comunicação com entregadores e empresas</p>
      </div>
      <Card className="flex h-96 items-center justify-center shadow-card">
        <div className="text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Chat em tempo real (em breve)</p>
        </div>
      </Card>
    </AdminLayout>
  );
}
