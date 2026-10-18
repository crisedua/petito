"use client";
import { Loader2 } from "lucide-react";
import { useLocation } from "@/lib/router";
import { useAuth } from "@/lib/auth";
import Login from "@/screens/Login";

// Gate that requires a logged-in user. Shows the Login screen inline (same path)
// so that after Google auth the user returns right here, now authenticated.
export default function RequireAuth({ children, subtitle }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mobile-frame grid place-items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Login returnPath={location.pathname} subtitle={subtitle} />;
  return children;
}
