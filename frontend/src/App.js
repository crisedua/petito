import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import AuthCallback from "@/components/AuthCallback";
import RequireAuth from "@/components/RequireAuth";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import Universe from "@/pages/Universe";
import Album from "@/pages/Album";
import MemoryCreate from "@/pages/MemoryCreate";
import MemoryView from "@/pages/MemoryView";
import PetProfile from "@/pages/PetProfile";
import PublicAlbum from "@/pages/PublicAlbum";
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
      <Route path="/bienvenida" element={<RequireAuth subtitle="Inicia sesión para crear el universo de tu mascota 🐾"><Onboarding /></RequireAuth>} />
      <Route path="/universo" element={<RequireAuth subtitle="Inicia sesión para entrar al universo de tu mascota 🐾"><Universe /></RequireAuth>} />
      <Route path="/album" element={<RequireAuth subtitle="Inicia sesión para ver los recuerdos de tu mascota 🤍"><Album /></RequireAuth>} />
      <Route path="/album/nuevo" element={<RequireAuth subtitle="Inicia sesión para guardar un recuerdo 🤍"><MemoryCreate /></RequireAuth>} />
      <Route path="/album/:id" element={<RequireAuth subtitle="Inicia sesión para ver este recuerdo 🤍"><MemoryView /></RequireAuth>} />
      <Route path="/perfil" element={<RequireAuth subtitle="Inicia sesión para editar el perfil de tu mascota 🐾"><PetProfile /></RequireAuth>} />
      <Route path="/u/:slug" element={<PublicAlbum />} />
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
