import type {WidgetKey} from "@/features/home/api/arrangement"
import {BalanceWidget} from "@/features/home/components/balance-widget"
import {NotesWidget} from "@/features/home/components/notes-widget"
import {RecentTransactions} from "@/features/home/components/recent-transactions"

/** One of the pieces a user can place on the home page. */
export function HomeWidget({widget}: {widget: WidgetKey}) {
	if (widget === "BalanceChart") return <BalanceWidget />
	if (widget === "Notes") return <NotesWidget />
	return <RecentTransactions />
}
