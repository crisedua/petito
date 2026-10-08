import { useState } from "react";
import { PawPrint } from "lucide-react";
import { submitSurvey } from "@/lib/api";

const DONE_KEY = "cp_survey_answered";

export const SurveyCard = ({ storyId }) => {
  const [status, setStatus] = useState(() =>
    localStorage.getItem(DONE_KEY) === "1" ? "hidden" : "ask"
  );

  if (status === "hidden") return null;

  const answer = async (value) => {
    localStorage.setItem(DONE_KEY, "1");
    setStatus("thanks");
    try { await submitSurvey(storyId, value); } catch { /* opinión igual guardada localmente */ }
    setTimeout(() => setStatus("hidden"), 2800);
  };

  if (status === "thanks") {
    return (
      <div className="mt-5 w-full rounded-2xl border border-border bg-white px-5 py-4 text-center animate-pop" data-testid="survey-thanks">
        <p className="font-display font-semibold text-neutral-900">¡Gracias por tu opinión! 🐾</p>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full rounded-2xl border-2 border-primary/20 bg-primary/5 px-5 py-4" data-testid="survey-card">
      <div className="flex items-start gap-2">
        <PawPrint className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="font-display font-semibold text-neutral-900 leading-snug">
          ¿Pagarías $9.900 al año por esta app?
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => answer("yes")}
          data-testid="survey-yes-button"
          className="flex-1 h-11 rounded-xl bg-primary text-white font-display font-semibold text-sm active:scale-95 transition-transform"
        >
          Sí
        </button>
        <button
          onClick={() => answer("no")}
          data-testid="survey-no-button"
          className="flex-1 h-11 rounded-xl bg-white border-2 border-border text-neutral-700 font-display font-semibold text-sm active:scale-95 transition-transform"
        >
          No
        </button>
      </div>
      <button
        onClick={() => setStatus("hidden")}
        data-testid="survey-dismiss"
        className="mt-2.5 w-full text-xs text-muted-foreground"
      >
        Ahora no
      </button>
    </div>
  );
};
