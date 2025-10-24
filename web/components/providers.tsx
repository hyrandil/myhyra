"use client";

import { PropsWithChildren } from "react";
import { AuthProvider } from "./auth-context";

export default function Providers({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}
