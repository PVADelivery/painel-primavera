import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MedalSidebar } from "@/components/medal/Sidebar";
import { MedalTopbar } from "@/components/medal/Topbar";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <MedalSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MedalTopbar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
