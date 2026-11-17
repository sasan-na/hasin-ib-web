import ReactDOM from "react-dom/client"
import "./index.css"
import "@/lib/i18n"
import {TooltipProvider} from "@/components/ui/tooltip.tsx";
import Routes from "./routing.tsx"
import {ErrorBoundary} from "@/components/error-boundary.tsx";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "@/lib/query-client.ts";
import {logger} from "@/lib/logger.ts";

if (import.meta.hot) {
    import.meta.hot.accept();
}

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
