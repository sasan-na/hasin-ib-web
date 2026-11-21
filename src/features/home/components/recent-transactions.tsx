import {useQuery} from "@tanstack/react-query"
import {ArrowLeftRight} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Skeleton} from "@/components/ui/skeleton"
import {recentTransactionsOptions} from "@/features/home/api/home.queries"
import {cn} from "@/lib/utils"

// The server's status codes: 0 done, 1 in progress, 2 failed, 3 needs reversing (anything else reads as 3).
const STATUS_STYLES: Record<number, {dot: string; text: string; badge: string}> = {
	0: {dot: "bg-success", text: "text-success", badge: "bg-success-soft text-success"},
	1: {dot: "bg-info", text: "text-info", badge: "bg-primary-soft text-primary"},
	2: {dot: "bg-destructive", text: "text-destructive", badge: "bg-destructive/10 text-destructive"},
	3: {dot: "bg-warning", text: "text-warning", badge: "bg-warning-soft text-warning-foreground"},
}

/** The user's latest transactions as a ledger: what, when, and how it ended. */
export function RecentTransactions() {
	const {t, i18n} = useTranslation()
	const query = useQuery(recentTransactionsOptions(i18n.language))

	return (
		<section aria-labelledby="recent-events-title" className="overflow-hidden rounded-[2rem] border bg-card shadow-card">
			<div className="border-b px-5 py-4 sm:px-6">
				<h2 id="recent-events-title" className="text-base font-semibold">
					{t("home.recentTransactions.title")}
				</h2>
				<p className="mt-1 text-xs text-muted-foreground">{t("home.recentTransactions.subtitle")}</p>
			</div>
			{query.isPending ? (
				<div className="flex flex-col gap-3 p-5" aria-hidden="true">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
			) : query.isError ? (
				<p role="alert" className="p-5 text-sm text-destructive">
					{t("home.recentTransactions.error")}
				</p>
			) : query.data.length === 0 ? (
				<p className="p-5 text-sm text-muted-foreground">{t("home.recentTransactions.empty")}</p>
			) : (
				<ul className="divide-y">
					{query.data.map((transaction, index) => {
						const style = STATUS_STYLES[transaction.status] ?? STATUS_STYLES[3]
						return (
							// The server sends no id for these rows; the list is short and never reordered client-side.
							<li key={index} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
								<span aria-hidden="true" className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", style.badge)}>
									<ArrowLeftRight className="size-5" />
								</span>
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="font-medium wrap-break-word">{transaction.type}</span>
									{/* Dates read left-to-right in both languages, as in the legacy app. */}
									<span dir="ltr" className="text-start text-sm text-muted-foreground">
										{transaction.date} {transaction.time}
									</span>
								</div>
								<span className={cn("flex items-center gap-2 text-sm font-medium", style.text)}>
									<span aria-hidden="true" className={cn("size-2 rounded-full", style.dot)} />
									{transaction.statusTitle}
								</span>
							</li>
						)
					})}
				</ul>
			)}
		</section>
	)
}
