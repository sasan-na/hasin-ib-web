import * as React from "react"
import {ArrowLeftRight, ClipboardCheck, Car, CreditCard, FileText, HandCoins, Home, Landmark, MessageSquare, Printer, Receipt, ScrollText, Users} from "lucide-react"
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
            title: t("navigation.cheques"),
            url: routeMap.chequeList.path,
            icon: FileText,
            isActive: pathname.startsWith(routeMap.chequeList.path),
        },
        {
            title: t("navigation.bills"),
            url: routeMap.billList.path,
            icon: Receipt,
            isActive: pathname.startsWith(routeMap.billList.path),
        },
        {
            title: t("navigation.etc"),
            url: routeMap.etcList.path,
            icon: Car,
            isActive: pathname.startsWith(routeMap.etcList.path),
        },
        {
            title: t("navigation.loans"),
            url: routeMap.loanList.path,
            icon: HandCoins,
            isActive: pathname.startsWith(routeMap.loanList.path),
        },
        {
            title: t("navigation.reports"),
            url: routeMap.report.path,
            icon: ScrollText,
            isActive: pathname.startsWith(routeMap.report.path),
        },
        {
            title: t("navigation.dashboard"),
            url: routeMap.dashboard.path,
            icon: ClipboardCheck,
            isActive: pathname.startsWith(routeMap.dashboard.path),
        },
        {
            title: t("navigation.receipts"),
            url: routeMap.receiptList.path,
            icon: Printer,
            isActive: pathname.startsWith(routeMap.receiptList.path),
        },
        {
            title: t("navigation.messages"),
            url: routeMap.messageList.path,
            icon: MessageSquare,
            isActive: pathname.startsWith(routeMap.messageList.path),
        },
        {
            title: t("navigation.contacts"),
            url: routeMap.contactList.path,
            icon: Users,
            isActive: pathname.startsWith(routeMap.contactList.path),
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
