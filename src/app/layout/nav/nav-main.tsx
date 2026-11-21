import {ChevronRight, type LucideIcon} from "lucide-react"

import {Collapsible, CollapsibleContent, CollapsibleTrigger,} from "@/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {useTranslation} from "react-i18next"
import {NavLink} from "react-router-dom";

export function NavMain({
                            items,
                            label,
                        }: {
    label?: string
    items: {
        title: string
        url: string
        icon?: LucideIcon
        isActive?: boolean
        items?: {
            title: string
            url: string
        }[]
    }[]
}) {
    const {t} = useTranslation()

    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label ?? t("navigation.general")}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    if (item?.items && item.items.length > 0) {
                        return <Collapsible
                            key={item.title}
                            asChild
                            defaultOpen={item.isActive}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && <item.icon/>}
                                        <span>{item.title}</span>
                                        <ChevronRight
                                            className="ms-auto transition-transform duration-200 rtl:rotate-180 group-data-[state=open]/collapsible:rotate-90"/>
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items?.map((subItem) => (
                                            <SidebarMenuSubItem key={subItem.title}>
                                                <SidebarMenuSubButton asChild>
                                                    <NavLink to={subItem.url}>
                                                        <span>{subItem.title}</span>
                                                    </NavLink>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    } else {
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild size="lg" isActive={item.isActive} tooltip={item.title} className="h-11 rounded-xl px-3 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-3">
                                    <NavLink to={item.url}>
                                        {item.icon && <item.icon/>}
                                        <span>{item.title}</span>
                                    </NavLink>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )
                    }
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}
