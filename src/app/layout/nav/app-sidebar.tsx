import * as React from "react"
import {ArrowLeftRight, CreditCard, Home, Landmark, ScrollText} from "lucide-react"
import {useLocation} from "react-router-dom"
import {useTranslation} from "react-i18next"

import {NavMain} from "@/app/layout/nav/nav-main"
import SidebarLogo from "@/app/layout/nav/nav-logo.tsx"
import {NavUser} from "@/app/layout/nav/nav-user"
import {Sidebar, SidebarContent, SidebarFooter, SidebarRail} from "@/components/ui/sidebar"
import {Separator} from "@/components/ui/separator.tsx"
import {routeMap} from "@/app/routes"

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
    const {pathname} = useLocation()
    const {t, i18n} = useTranslation()

    const navMain = [
        {
            title: t("navigation.home"),
            url: routeMap.home.path,
            icon: Home,
            isActive: pathname === routeMap.home.path,
        },
        {
            title: t("navigation.accounts"),
            url: routeMap.account.path,
            icon: Landmark,
            isActive: pathname.startsWith(routeMap.account.path),
        },
        {
            title: t("navigation.cards"),
            url: routeMap.card.path,
            icon: CreditCard,
            isActive: pathname.startsWith(routeMap.card.path),
        },
        {
            title: t("navigation.transfers"),
            url: routeMap.transfer.path,
            icon: ArrowLeftRight,
            isActive: pathname.startsWith(routeMap.transfer.path),
        },
        {
            title: t("navigation.reports"),
            url: routeMap.reportStatement.path,
            icon: ScrollText,
            isActive: pathname.startsWith("/report"),
        },
    ]

    return (
        <Sidebar side={i18n.dir() === "rtl" ? "right" : "left"} variant={"sidebar"} collapsible="offcanvas" {...props}>
            <SidebarLogo/>
            <Separator orientation="horizontal"/>
            <SidebarContent>
                <NavMain items={navMain}/>
            </SidebarContent>
            <Separator orientation="horizontal"/>
            <SidebarFooter>
                <NavUser/>
            </SidebarFooter>
            <SidebarRail/>
        </Sidebar>
    )
}
