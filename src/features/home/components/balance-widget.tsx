import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Skeleton} from "@/components/ui/skeleton"
import {getBalanceDiagram, getValidPeriod} from "@/features/report/api/balance"
import {BalanceChart} from "@/features/report/components/balance-chart"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"

// The bank's name for the service: which accounts may be reported on.
const SERVICE = "AccountTotalStatement"
const DAYS = 30

const isoDay = (offset: number): string => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("sv-SE")

/** How the balance of one account moved over the last month (or the longest span the bank allows, if shorter). */
export function BalanceWidget() {
	const {t, i18n} = useTranslation()
	const [account, setAccount] = useState<SourceAccount | null>(null)
	const period = useQuery({queryKey: ["report", "balance-period"], queryFn: getValidPeriod, staleTime: 10 * 60_000, retry: false})
	const span = Math.min(DAYS, period.data ?? DAYS)
	const diagram = useQuery({
		queryKey: ["home", "balance", account?.number, span],
		queryFn: () => getBalanceDiagram(account?.number ?? "", isoDay(1 - span), isoDay(0)),
		enabled: account !== null && period.data !== undefined,
		staleTime: 60_000,
		retry: false,
	})

	return (
		<section aria-labelledby="balance-title" className="overflow-hidden rounded-lg bg-card">
			<h2 id="balance-title" className="border-b px-5 py-4 text-base font-semibold">
				{t("home.balance.title")}
			</h2>
			<div className="flex flex-col gap-4 p-5">
				<SourceAccountSelect id="home-balance-account" serviceName={SERVICE} value={account?.id ?? null} onChange={setAccount} />
				{account === null ? (
					<p className="text-sm text-muted-foreground">{t("home.balance.choose")}</p>
				) : diagram.isPending ? (
					<Skeleton className="h-48 w-full" />
				) : diagram.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{diagram.error.message || t("home.balance.error")}
					</p>
				) : diagram.data.days.length === 0 ? (
					<p className="text-sm text-muted-foreground">{diagram.data.note || t("home.balance.empty")}</p>
				) : (
					<BalanceChart days={diagram.data.days} persian={i18n.language !== "en"} />
				)}
			</div>
		</section>
	)
}
