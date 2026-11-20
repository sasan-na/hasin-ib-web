import React from "react";
import {Bell, CircleHelp} from "lucide-react";
import {useQuery} from "@tanstack/react-query";
import {toast} from "sonner";
import {NavLink, Outlet, useLocation, useNavigate} from "react-router-dom";
import {AppSidebar} from "@/app/layout/nav/app-sidebar"
import {Button} from "@/components/ui/button"
import {messagesOptions} from "@/features/message/api/message.queries"
import {Separator} from "@/components/ui/separator"
import {SidebarInset, SidebarProvider, SidebarTrigger,} from "@/components/ui/sidebar"
import {findRouteByPath} from "@/lib/utils.ts";
import {useTranslation} from "react-i18next";
import {LanguageSwitcher} from "@/components/language-switcher.tsx";
import {ThemeSwitcher} from "@/components/theme-switcher.tsx";
import {Logo} from "@/components/logo.tsx";
import {Toaster} from "@/components/ui/sonner.tsx"
import {HeaderSearch} from "@/app/layout/header-search"
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
    const navigate = useNavigate();
    const messages = useQuery(messagesOptions());
    const unread = (messages.data ?? []).reduce((sum, item) => sum + (item.isUnread ? Math.max(1, item.unreadCount) : 0), 0);
    const openNotifications = () => {
        if (unread > 0) navigate(routeMap.messageList.path);
        else toast.info(t("header.noNotifications"));
    };
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
                    <header
                        className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
                        <div className="flex min-w-0 items-center gap-2">
                            <SidebarTrigger className="-ms-1.5 rounded-xl"/>
                            <NavLink to={routeMap.home.path}
                                     className="flex items-center gap-2 fill-primary md:hidden">
                                <Logo size={20} className="fill-inherit"/>
                                <span className="text-sm font-semibold">{t("appName")}</span>
                            </NavLink>
                            <div className="hidden min-w-0 items-center gap-2 md:flex">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="size-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true"/>
                                    <span>{t("header.systemStatus")}</span>
                                </div>
                                <Separator orientation="vertical" className="mx-1 h-4"/>
                                <BreadcrumbResponsive items={breadcrumbItems}/>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <HeaderSearch/>
                            <Button variant="ghost" size="icon" asChild
                                    className="size-9 rounded-xl text-muted-foreground hover:text-foreground">
                                <NavLink to={routeMap.other.path} aria-label={t("header.help")} title={t("header.help")}>
                                    <CircleHelp className="size-4"/>
                                </NavLink>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={openNotifications}
                                    aria-label={t("header.notifications")} title={t("header.notifications")}
                                    className="relative size-9 rounded-xl text-muted-foreground hover:text-foreground">
                                <Bell className="size-4"/>
                                {unread > 0 ? <span
                                    className="absolute top-1.5 end-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"/> : null}
                            </Button>
                            <ThemeSwitcher/>
                            <LanguageSwitcher/>
                        </div>
                    </header>
                    <div className={"flex flex-col"}>
                        {/* Main entry for content */}
                        <div className={"w-full self-center px-5 pb-6 md:container"}>
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