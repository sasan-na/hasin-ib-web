import * as React from "react"
import {Home} from "lucide-react"
import {useLocation} from "react-router-dom"

import {NavMain} from "@/components/nav/nav-main"
import SidebarLogo from "@/components/nav/nav-logo.tsx"
import {Sidebar, SidebarContent, SidebarRail} from "@/components/ui/sidebar"
import {Separator} from "@/components/ui/separator.tsx"
import {routeMap} from "@/routing.tsx"

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
    const {pathname} = useLocation()

    const navMain = [
        {
            title: "Home",
            url: routeMap.home.path,
            icon: Home,
            isActive: pathname === routeMap.home.path,
        },
    ]

    return (
        <Sidebar variant={"sidebar"} collapsible="offcanvas" {...props}>
            <SidebarLogo/>
            <Separator orientation="horizontal"/>
            <SidebarContent>
                <NavMain items={navMain}/>
            </SidebarContent>
            <SidebarRail/>
        </Sidebar>
    )
}
