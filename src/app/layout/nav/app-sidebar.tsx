import * as React from "react"
import {ArrowLeftRight, ClipboardCheck, CreditCard, FileText, HandCoins, Home, Landmark, Building2, ShieldCheck, Receipt, ScrollText, Shapes, FileSignature} from "lucide-react"
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
            url: routeMap.cheque.path,
            icon: FileText,
            isActive: pathname.startsWith(routeMap.cheque.path),
        },
        {
            title: t("navigation.digitalCheques"),
            url: routeMap.digitalCheque.path,
            icon: FileSignature,
            isActive: pathname.startsWith(routeMap.digitalCheque.path),
        },
        {
            title: t("navigation.loans"),
            url: routeMap.loan.path,
            icon: HandCoins,
            isActive: pathname.startsWith(routeMap.loan.path),
        },
        {
            title: t("navigation.payments"),
            url: routeMap.payment.path,
            icon: Receipt,
            isActive: pathname.startsWith(routeMap.payment.path) || pathname.startsWith(routeMap.billList.path) || pathname.startsWith(routeMap.etcList.path),
        },
        {
            title: t("navigation.branch"),
            url: routeMap.branch.path,
            icon: Building2,
            isActive: pathname.startsWith(routeMap.branch.path),
        },
        {
            title: t("navigation.reports"),
            url: routeMap.report.path,
            icon: ScrollText,
            isActive: pathname.startsWith(routeMap.report.path),
        },
        {
            title: t("navigation.dashboard"),
            url: routeMap.dashboardHome.path,
            icon: ClipboardCheck,
            isActive: pathname.startsWith(routeMap.dashboardHome.path),
        },
        {
            title: t("navigation.security"),
            url: routeMap.security.path,
            icon: ShieldCheck,
            isActive: pathname.startsWith(routeMap.security.path),
        },
        {
            title: t("navigation.other"),
            url: routeMap.other.path,
            icon: Shapes,
            isActive: pathname.startsWith(routeMap.other.path) || pathname.startsWith(routeMap.receiptList.path) || pathname.startsWith(routeMap.messageList.path) || pathname.startsWith(routeMap.contactList.path),
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
