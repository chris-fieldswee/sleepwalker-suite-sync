// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// *** UPDATED: Import Outlet for nested routes ***
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Reception from "./pages/Reception";
import Housekeeping from "./pages/Housekeeping";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            {/* *** UPDATED: Reception route to allow sub-routes *** */}
            <Route
              path="/reception/*" // Use /* to match nested paths
              element={
                <ProtectedRoute allowedRoles={["reception", "admin"]}>
                  <Reception />
                  {/* Outlet will render nested route components if defined */}
                  {/* We will handle view switching within Reception.tsx for now */}
                </ProtectedRoute>
              }
            />
            <Route
              path="/housekeeping"
              element={
                <ProtectedRoute allowedRoles={["housekeeping", "admin"]}>
                  <Housekeeping />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
