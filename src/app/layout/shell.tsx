import React from "react";
import {Outlet, useLocation} from "react-router-dom";
import {AppSidebar} from "@/app/layout/nav/app-sidebar"
import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar"
import {findRouteByPath} from "@/lib/utils.ts";
import {useTranslation} from "react-i18next";
import {LanguageSwitcher} from "@/components/language-switcher.tsx";
import {ThemeSwitcher} from "@/components/theme-switcher.tsx";
import {Logo} from "@/components/logo.tsx";
import {Toaster} from "@/components/ui/sonner.tsx"
import {TopBar} from "@/app/layout/top-bar"
import {BreadcrumbItem, BreadcrumbResponsive} from "@/app/layout/breadcrumbs"
import {routeMap} from "@/app/routes";
import {ErrorBoundary} from "@/components/error-boundary.tsx";
import Loading from "@/app/pages/loading.tsx";

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
            <SidebarProvider style={{"--sidebar-width": "16.4rem", "--sidebar-width-icon": "4.4rem"} as React.CSSProperties}>
                <AppSidebar/>
                <SidebarInset>
                    <TopBar/>
                    <div className={"flex flex-col"}>
                        {/* Main entry for content */}
                        <div className={"w-full self-center px-5 pb-6 md:container"}>
                            <div className="py-3"><BreadcrumbResponsive items={breadcrumbItems}/></div>
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
    const {t} = useTranslation();
    return (
        <div id={"public"}>
            <div className="flex min-h-screen w-full flex-col">
                <header className="flex items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-2">
                        <Logo size={20} className="fill-primary"/>
                        <span className="text-base font-semibold">{t("appName")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ThemeSwitcher/>
                        <LanguageSwitcher/>
                    </div>
                </header>
                <main className="flex flex-1 items-start justify-center px-4 pb-8 sm:items-center">
                    <RouteFrame>{children}</RouteFrame>
                </main>
            </div>
        </div>
    );
}