import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AdminSidebar } from "./AdminSidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <main className="md:ml-64 min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 pt-16 md:p-8 md:pt-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
