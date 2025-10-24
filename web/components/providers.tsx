"use client";

import { PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { AuthProvider } from "./auth-context";

export default function Providers({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          shouldRetryOnError: false,
        }}
      >
        {children}
      </SWRConfig>
    </AuthProvider>
  );
}
