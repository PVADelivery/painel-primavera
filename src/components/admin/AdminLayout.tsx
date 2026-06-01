import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AdminSidebar } from "./AdminSidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="relative min-h-screen bg-background">
        {/* Ambient background */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-40 left-1/3 h-[480px] w-[480px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[140px]" />
        </div>

        <AdminSidebar />
        <main className="md:ml-64 min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-[1400px] p-4 pt-16 md:p-8 md:pt-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
