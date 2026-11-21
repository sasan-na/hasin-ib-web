import {useQuery} from "@tanstack/react-query"
import {Activity, ArrowDownLeft, ArrowUpLeft} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Skeleton} from "@/components/ui/skeleton"
import {accountsOptions} from "@/features/account/api/account.queries"
import {getMonthlyReport, type CalendarDay} from "@/features/report/api/monthly"
import {formatAmount} from "@/lib/format"
import {todayJalali} from "@/lib/jalali"
import {MASK, usePrivacyStore} from "@/store/privacy"

/** The current year and month in the calendar the bank counts months in (Persian for Persian, Gregorian for English). */
const currentMonth = (persian: boolean): {year: number; month: number} => {
	if (persian) {
		const [year, month] = todayJalali().split("/").map(Number)
		return {year, month}
	}
	const now = new Date()
	return {year: now.getFullYear(), month: now.getMonth() + 1}
}

/** Sums the days into weeks of seven, so the chart has at most six bars per kind. */
const weekly = (days: CalendarDay[]): {income: number; expense: number}[] => {
	const weeks: {income: number; expense: number}[] = []
	days.forEach((day, index) => {
		const week = Math.floor(index / 7)
		weeks[week] ??= {income: 0, expense: 0}
		weeks[week].income += day.deposit
		weeks[week].expense += day.withdrawal
	})
	return weeks
}

/** What came in and went out of the user's first account this month, from the bank's monthly report. */
export function MonthlySnapshot() {
	const {t, i18n} = useTranslation()
	const persian = i18n.language !== "en"
	const hidden = usePrivacyStore((s) => s.hidden)
	const accounts = useQuery(accountsOptions(i18n.language))
	const account = accounts.data?.[0]
	const {year, month} = currentMonth(persian)
	const report = useQuery({
		queryKey: ["home", "monthly", account?.number, i18n.language, year, month],
		queryFn: () => getMonthlyReport(account?.number ?? "", year, month),
		enabled: account !== undefined,
		staleTime: 5 * 60_000,
		retry: false,
	})

	const money = (value: number): string => (hidden ? MASK : formatAmount(value, i18n.language))
	const data = report.data
	const remaining = data ? data.totalDeposit - data.totalWithdrawal : 0
	const savedRatio = data && data.totalDeposit > 0 ? Math.round((remaining / data.totalDeposit) * 100) : null
	const weeks = data ? weekly(data.days) : []
	const peak = Math.max(1, ...weeks.flatMap((week) => [week.income, week.expense]))
	const monthName = new Intl.DateTimeFormat(persian ? `${i18n.language}-u-ca-persian` : i18n.language, {month: "long", year: "numeric"}).format(new Date())

	return (
		<section aria-labelledby="monthly-title" className="flex h-full min-w-0 flex-col gap-5 rounded-[2rem] border bg-card p-6 shadow-card">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="monthly-title" className="flex items-center gap-2 text-base font-semibold">
						<Activity aria-hidden="true" className="size-4 text-primary" />
						{t("home.monthly.title")}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">{account ? `${monthName} · ${account.name || account.number}` : monthName}</p>
				</div>
				{savedRatio !== null && savedRatio > 0 ? (
					<span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-soft-foreground">{t("home.monthly.saved", {percent: savedRatio})}</span>
				) : null}
			</div>

			{accounts.isPending || (account !== undefined && report.isPending) ? (
				<Skeleton className="h-52 w-full" />
			) : accounts.isError || report.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{t("home.monthly.error")}
				</p>
			) : data === undefined ? (
				<p className="text-sm text-muted-foreground">{t("home.monthly.none")}</p>
			) : (
				<>
					<div aria-live="polite">
						<p className="text-xs text-muted-foreground">{t("home.monthly.remaining")}</p>
						<p className="mt-1 text-2xl font-bold tabular-nums">
							{money(remaining)}
							<span className="ms-2 text-xs font-normal text-muted-foreground">{t("home.wallet.rial")}</span>
						</p>
					</div>

					<div className="flex h-24 items-end gap-2 border-b" aria-hidden="true">
						{weeks.map((week, index) => (
							<div key={index} className="flex h-full flex-1 items-end justify-center gap-1">
								<span className="w-2.5 rounded-t-full bg-primary/80" style={{height: `${Math.max(2, (week.income / peak) * 100)}%`}} />
								<span className="w-2.5 rounded-t-full bg-muted-foreground/40" style={{height: `${Math.max(2, (week.expense / peak) * 100)}%`}} />
							</div>
						))}
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-xl bg-success-soft/70 p-3">
							<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<ArrowDownLeft aria-hidden="true" className="size-3.5 text-success" />
								{t("home.monthly.deposits")}
							</p>
							<p className="mt-2 truncate text-sm font-bold tabular-nums">{money(data.totalDeposit)}</p>
						</div>
						<div className="rounded-xl bg-muted/70 p-3">
							<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<ArrowUpLeft aria-hidden="true" className="size-3.5" />
								{t("home.monthly.withdrawals")}
							</p>
							<p className="mt-2 truncate text-sm font-bold tabular-nums">{money(data.totalWithdrawal)}</p>
						</div>
					</div>
					<Link to={routeMap.reportMonthly.path} className="text-xs font-semibold text-brand hover:underline">
						{t("home.monthly.more")}
					</Link>
				</>
			)}
		</section>
	)
}
