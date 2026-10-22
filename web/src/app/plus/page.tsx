"use client";
import { screen } from "@/components/app/Screen";

// Public: anyone can see the plans; subscribing asks for Google sign-in.
export default screen(() => import("@/screens/Plus"));
