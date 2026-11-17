import * as React from "react"
import {Home, Landmark} from "lucide-react"
import {useLocation} from "react-router-dom"
import {useTranslation} from "react-i18next"

import {NavMain} from "@/components/nav/nav-main"
import SidebarLogo from "@/components/nav/nav-logo.tsx"
import {NavUser} from "@/components/nav/nav-user"
import {Sidebar, SidebarContent, SidebarFooter, SidebarRail} from "@/components/ui/sidebar"
import {Separator} from "@/components/ui/separator.tsx"
import {routeMap} from "@/routing.tsx"

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
