import React from "react";
import {Outlet, useLocation} from "react-router-dom";
import {AppSidebar} from "@/components/nav/app-sidebar"
import {Separator} from "@/components/ui/separator"
import {SidebarInset, SidebarProvider, SidebarTrigger,} from "@/components/ui/sidebar"
import {findRouteByPath} from "@/lib/utils.ts";
import {useTranslation} from "react-i18next";
import {LanguageSwitcher} from "@/components/language-switcher.tsx";
import {ThemeSwitcher} from "@/components/theme-switcher.tsx";
import {Toaster} from "@/components/ui/sonner.tsx"
import {BreadcrumbItem, BreadcrumbResponsive} from "@/components/breadcrumbs"
import {routeMap} from "@/routing.tsx";
import {ErrorBoundary} from "@/components/error-boundary.tsx";
import Loading from "@/routes/loading.tsx";

const RouteFrame = ({children}: {children?: React.ReactNode}) => (
    <ErrorBoundary>
        <React.Suspense fallback={<Loading/>}>
            {children ?? <Outlet/>}
        </React.Suspense>
    </ErrorBoundary>
);

export function AuthShell({children}: { children?: React.ReactNode }): React.ReactElement {
    const {pathname} = useLocation();
    const {t} = useTranslation();
    const breadcrumbs: string[] = pathname.split("/");

    const breadcrumbItems = React.useMemo((): BreadcrumbItem[] => {
        const bc = breadcrumbs;
        if (bc[0] === "") bc.splice(0, 1);
        return bc.map((path: string, i: number): BreadcrumbItem => {
            const href = "/" + bc.slice(0, i + 1).join("/")
            const key = findRouteByPath(routeMap, href ?? path)?.["breadcrumb"]
            const label = key ? t(key as never) : path
            return {
                label: label,
                href: href
            }
        })
    }, [breadcrumbs, t])

    React.useEffect(() => {
        document.title = t("appName")
    }, [pathname, t])

    return (
        <div id={"auth"} data-vaul-drawer-wrapper="">
            <SidebarProvider>
                <AppSidebar/>
                <SidebarInset>
                    <div className={"flex flex-col"}>
                        {/* Main entry for content */}
                        <div className={"w-full self-center px-5 md:container"}>
                            <header
                                className="relative z-50 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                                <div className="flex items-center">
                                    <SidebarTrigger className="-ms-1.5"/>
                                    <Separator orientation="vertical" className="me-2 h-4"/>
                                    <BreadcrumbResponsive items={breadcrumbItems}/>
                                </div>
                                <div className="ms-auto flex items-center gap-1">
                                    <ThemeSwitcher/>
                                    <LanguageSwitcher/>
                                </div>
                            </header>
                            <RouteFrame>{children}</RouteFrame>
                        </div>
                        {/* - */}
                    </div>
                    <Toaster/>
                </SidebarInset>
            </SidebarProvider>
        </div>
    );
}

export function PublicShell({children}: {children?: React.ReactNode}): React.ReactElement {
    return (
        <div id={"public"}>
            <div className="flex min-h-screen w-full flex-col">
                <header className="flex items-center justify-end gap-1 p-4">
                    <ThemeSwitcher/>
                    <LanguageSwitcher/>
                </header>
                <main className="flex flex-1 items-start justify-center px-4 pb-8 sm:items-center">
                    <RouteFrame>{children}</RouteFrame>
                </main>
            </div>
        </div>
    );
}