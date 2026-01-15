import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ipcLink } from "trpc-electron/renderer"
import { trpc } from "../lib/trpc"
import superjson from "superjson"

interface TRPCProviderProps {
  children: React.ReactNode
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5000,
          refetchOnWindowFocus: false,
          networkMode: "always",
          retry: false,
        },
        mutations: {
          networkMode: "always",
          retry: false,
        },
      },
    })
  })

  const [trpcClient] = useState(() => {
    const client = trpc.createClient({
      links: [ipcLink({ transformer: superjson })],
    })
    return client
  })

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
