import ReactDOM from "react-dom/client"
import "./index.css"
import "@/lib/i18n"
import {TooltipProvider} from "@/components/ui/tooltip.tsx";
import Routes from "./app/router.tsx"
import {ErrorBoundary} from "@/components/error-boundary.tsx";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "@/lib/query-client.ts";
import {logAppVersion} from "@/lib/app-version.ts";

logAppVersion()

if (import.meta.hot) {
    import.meta.hot.accept();
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
