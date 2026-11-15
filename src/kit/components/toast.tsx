"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AnimatedToastStack, useAnimatedToastStack, type ToastInput } from "@/components/motion/animated-toast-stack";

type ToastApi = ReturnType<typeof useAnimatedToastStack>;
const ToastContext = createContext<ToastApi | null>(null);

/** Mounted once in layout.tsx. Spectrum's animated toast stack, bottom-centre on phones. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const api = useAnimatedToastStack({ defaultDuration: 3200, limit: 4 });
  return (
    <ToastContext.Provider value={api}>
      {children}
      <AnimatedToastStack toasts={api.toasts} onDismiss={api.dismissToast} position="bottom-center" fixed portal />
    </ToastContext.Provider>
  );
}

/** `const toast = useToast(); toast({ title: "Converged", status: "success" })` */
export function useToast(): (t: ToastInput) => string {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api.showToast;
}

export function useToastApi(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToastApi must be used inside <ToastProvider>");
  return api;
}
