import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import AuthCallback from "@/components/AuthCallback";
import RequireAuth from "@/components/RequireAuth";
import Landing from "@/pages/Landing";
import Create from "@/pages/Create";
import Portrait from "@/pages/Portrait";
import Memorial from "@/pages/Memorial";
import Talk from "@/pages/Talk";
import StoryView from "@/pages/StoryView";
import PortraitView from "@/pages/PortraitView";
import TalkView from "@/pages/TalkView";
import MyCreations from "@/pages/MyCreations";
import Admin from "@/pages/Admin";

function AppRoutes() {
  const location = useLocation();
  // Process the OAuth callback FIRST (synchronously during render) to avoid race conditions.
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/crear" element={<RequireAuth subtitle="Inicia sesión para crear la historia de tu mascota 🐾"><Create /></RequireAuth>} />
      <Route path="/retrato" element={<RequireAuth subtitle="Inicia sesión para crear el retrato de tu mascota 👑"><Portrait /></RequireAuth>} />
      <Route path="/recuerdo" element={<RequireAuth subtitle="Inicia sesión para crear el retrato recuerdo de tu mascota 🤍"><Memorial /></RequireAuth>} />
      <Route path="/hablar" element={<RequireAuth subtitle="Inicia sesión para crear el video completo de tu mascota 🗣️"><Talk /></RequireAuth>} />
      <Route path="/mis-creaciones" element={<RequireAuth subtitle="Inicia sesión para ver tus historias y retratos"><MyCreations /></RequireAuth>} />
      <Route path="/h/:slug" element={<StoryView />} />
      <Route path="/r/:slug" element={<PortraitView />} />
      <Route path="/v/:slug" element={<TalkView />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
