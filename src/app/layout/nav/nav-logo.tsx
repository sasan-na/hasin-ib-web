import {ShieldCheck} from "lucide-react"
import {useTranslation} from "react-i18next"
import {NavLink} from "react-router-dom"

import {routeMap} from "@/app/routes"

/** The bank's mark and name at the top of the sidebar; only the mark stays when the sidebar is collapsed. */
export default function SidebarLogo() {
	const {t} = useTranslation()
	return (
		<div className="p-4 pb-3 group-data-[collapsible=icon]:p-3">
			<NavLink
				to={routeMap.home.path}
				aria-label={t("appName")}
				className="flex h-12 min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
			>
				<span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card">
					<ShieldCheck aria-hidden="true" className="size-5" />
				</span>
				<span className="min-w-0 group-data-[collapsible=icon]:hidden">
					<span className="block truncate text-lg font-extrabold tracking-tight">{t("appName")}</span>
					<span className="block truncate text-[11px] font-normal text-muted-foreground">{t("navigation.tagline")}</span>
				</span>
			</NavLink>
		</div>
	)
}
