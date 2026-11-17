import {useTranslation} from "react-i18next"
import {NavLink} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {cn} from "@/lib/utils"

/** The two ways to pay loans by number, shown as tabs on both pages: one loan, or several at once. */
export function OtherLoanTabs() {
	const {t} = useTranslation()
	const tabs = [
		{to: routeMap.loanOther.path, label: t("loan.other.tabSingle")},
		{to: routeMap.loanBatch.path, label: t("loan.other.tabBatch")},
	]
	return (
		<nav aria-label={t("loan.other.title")} className="flex gap-1 border-b">
			{tabs.map((tab) => (
				<NavLink key={tab.to} to={tab.to} end className={({isActive}) => cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
					{tab.label}
				</NavLink>
			))}
		</nav>
	)
}
