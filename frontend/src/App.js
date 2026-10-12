import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import Create from "@/pages/Create";
import Portrait from "@/pages/Portrait";
import StoryView from "@/pages/StoryView";
import PortraitView from "@/pages/PortraitView";
import Admin from "@/pages/Admin";

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/crear" element={<Create />} />
          <Route path="/retrato" element={<Portrait />} />
          <Route path="/h/:slug" element={<StoryView />} />
          <Route path="/r/:slug" element={<PortraitView />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
