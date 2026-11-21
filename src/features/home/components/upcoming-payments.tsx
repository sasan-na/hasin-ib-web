import {useQuery} from "@tanstack/react-query"
import {CalendarClock, ChevronRight, Landmark} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Skeleton} from "@/components/ui/skeleton"
import {loansOptions} from "@/features/loan/api/loan.queries"
import {formatAmount} from "@/lib/format"
import {MASK, usePrivacyStore} from "@/store/privacy"

const SHOWN = 3

/** The next installments of the user's own loans, nearest due date first. */
export function UpcomingPayments() {
	const {t, i18n} = useTranslation()
	const hidden = usePrivacyStore((s) => s.hidden)
	const loans = useQuery(loansOptions(i18n.language))
	// The dates arrive in the calendar of the UI language as year/month/day, so they sort as text.
	const due = (loans.data ?? [])
		.filter((loan) => !loan.isOther && loan.nextDueDate !== "" && loan.error === "")
		.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
		.slice(0, SHOWN)

	return (
		<section aria-labelledby="upcoming-title" className="h-full min-w-0 rounded-[2rem] border bg-card p-5 shadow-card sm:p-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="upcoming-title" className="flex items-center gap-2 text-base font-semibold">
						<CalendarClock aria-hidden="true" className="size-4 text-primary" />
						{t("home.upcoming.title")}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">{t("home.upcoming.hint")}</p>
				</div>
				{due.length > 0 ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning-soft text-xs font-bold text-warning-foreground">{due.length}</span> : null}
			</div>

			{loans.isPending ? (
				<Skeleton className="mt-4 h-40 w-full" />
			) : loans.isError ? (
				<p role="alert" className="mt-4 text-sm text-destructive">
					{t("home.upcoming.error")}
				</p>
			) : due.length === 0 ? (
				<p className="mt-4 text-sm text-muted-foreground">{t("home.upcoming.none")}</p>
			) : (
				<ul className="mt-4 divide-y">
					{due.map((loan, index) => (
						<li key={`${loan.accountNumber}${loan.cardNumber}${index}`} className="flex items-center gap-3 py-3.5">
							<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
								<Landmark aria-hidden="true" className="size-4" />
							</span>
							<div className="min-w-0 flex-1">
								<h3 className="truncate text-sm font-semibold">{loan.title || t("loan.title")}</h3>
								<p className="mt-1 text-xs text-muted-foreground tabular-nums">{loan.nextDueDate}</p>
							</div>
							<div className="shrink-0 text-end">
								<p className="text-xs font-semibold tabular-nums">{hidden ? MASK : loan.installment === null ? "—" : formatAmount(loan.installment, i18n.language)}</p>
								<Link to={routeMap.loanList.path} className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
									{t("home.upcoming.pay")}
									<ChevronRight aria-hidden="true" className="size-3 rtl:-scale-x-100" />
								</Link>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
