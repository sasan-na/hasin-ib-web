import ReactDOM from "react-dom/client"
import "./index.css"
import "@/lib/i18n"
import {TooltipProvider} from "@/components/ui/tooltip.tsx";
import Routes from "./routing.tsx"
import {ErrorBoundary} from "@/components/error-boundary.tsx";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {logger} from "@/lib/logger.ts";

if (import.meta.hot) {
    import.meta.hot.accept();
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
        mutations: {
            retry: 0,
        },
    },
});

async function startApp() {
    // Dev only: answer the legacy login API with mocks. VITE_ENABLE_MSW=false uses a real backend.
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW !== "false") {
        try {
            const {worker} = await import("@/mocks/browser")
            await worker.start({onUnhandledRequest: "bypass"})
        } catch (error) {
            logger.error("[msw] failed to start the mock worker", {reason: String(error)})
        }
    }

    ReactDOM.createRoot(document.getElementById("root")!).render(
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                    <Routes/>
                </TooltipProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    )
}

void startApp()
