"use client";

import type { ReactNode } from "react";
import { Bounce, ToastContainer, toast as toastify } from "react-toastify";

export type ToastKind = "success" | "error" | "info";

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

/** Thin wrapper over react-toastify so call sites keep the useToast() API. */
const api: ToastApi = {
  toast: (message, kind = "info") => toastify(message, { type: kind }),
  success: (message) => toastify.success(message),
  error: (message) => toastify.error(message),
};

/** Renders the react-toastify container once for the whole app. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        limit={3}
        newestOnTop
        closeOnClick
        pauseOnHover
        pauseOnFocusLoss={false}
        draggable
        theme="light"
        transition={Bounce}
      />
    </>
  );
}

export function useToast(): ToastApi {
  return api;
}
