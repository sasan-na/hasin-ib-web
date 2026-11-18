import {useMutation} from "@tanstack/react-query"
import {Printer} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {getMonthlyReport, type CalendarDay, type DayStatement} from "@/features/report/api/monthly"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {formatAmount} from "@/lib/format"
import {jalaliToIso, todayJalali} from "@/lib/jalali"
import {cn} from "@/lib/utils"

// The bank's name for the service: which accounts may be reported on.
const SERVICE = "AccountTotalStatement"
// The oldest year the bank's calendar offers, in each calendar.
const OLDEST = {fa: 1317, en: 1938}

interface Today {
	year: number
	month: number
}

/** The current year and month in the calendar the bank counts months in (Persian for Persian, Gregorian for English). */
const currentMonth = (persian: boolean): Today => {
	if (persian) {
		const [year, month] = todayJalali().split("/").map(Number)
		return {year, month}
	}
	const now = new Date()
	return {year: now.getFullYear(), month: now.getMonth() + 1}
}

/** The name of a month number, written in the language and calendar of the page. */
const monthName = (month: number, persian: boolean, year: number, language: string): string => {
	if (persian) {
		const iso = jalaliToIso(`${String(year)}/${String(month).padStart(2, "0")}/01`)
		return iso ? new Intl.DateTimeFormat(`${language}-u-ca-persian`, {month: "long", timeZone: "UTC"}).format(new Date(`${iso}T12:00:00Z`)) : String(month)
	}
	return new Intl.DateTimeFormat(language, {month: "long", timeZone: "UTC"}).format(new Date(Date.UTC(year, month - 1, 1, 12)))
}

/** Seven weekday names starting on `firstDay` (a date that falls on the first weekday shown). */
const weekdayNames = (language: string, firstDay: string): string[] =>
	Array.from({length: 7}, (_, index) => new Intl.DateTimeFormat(language, {weekday: "short", timeZone: "UTC"}).format(new Date(`${firstDay}T12:00:00Z`).getTime() + index * 86_400_000))

/** Money in and out of an account, day by day, as a calendar of one month. */
export default function MonthlyPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const persian = language !== "en"
	const now = currentMonth(persian)

	const [account, setAccount] = React.useState<SourceAccount | null>(null)
	const [year, setYear] = React.useState(now.year)
	const [month, setMonth] = React.useState(now.month)
	const [shown, setShown] = React.useState<{year: number; month: number} | null>(null)
	const [details, setDetails] = React.useState<{day: CalendarDay; deposit: boolean} | null>(null)

	const report = useMutation({mutationFn: () => getMonthlyReport(account?.number ?? "", year, month)})

	const oldest = persian ? OLDEST.fa : OLDEST.en
	const years = Array.from({length: now.year - oldest + 1}, (_, index) => now.year - index)
	const lastMonth = year === now.year ? now.month : 12
	const money = (value: number): string => `${formatAmount(value, language)} ${t("report.monthly.rial")}`

	// Persian weeks start on Saturday; English ones on Monday.
	const weekdays = weekdayNames(language, persian ? "2024-01-06" : "2024-01-01")
	const weekendColumns = persian ? [7] : [6, 7]
	const leading = report.data ? Math.max(0, report.data.startDay - 1) : 0
	const cells: (CalendarDay | null)[] = report.data ? [...Array.from({length: leading}, () => null), ...report.data.days] : []
	while (cells.length % 7 !== 0) cells.push(null)

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
				<h1 className="text-2xl font-bold">{t("report.monthly.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportBalance.path}>{t("report.balance.title")}</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportPeriodic.path}>{t("report.periodic.title")}</Link>
					</Button>
				</div>
			</div>

			<form
				className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-3 print:hidden"
				onSubmit={(event) => {
					event.preventDefault()
					if (account && !report.isPending) {
						setShown({year, month})
						report.mutate()
					}
				}}
			>
				<div className="flex flex-col gap-2 sm:col-span-3">
					<Label htmlFor="mo-account">{t("report.statement.account")}</Label>
					<SourceAccountSelect
						id="mo-account"
						serviceName={SERVICE}
						value={account?.id ?? null}
						onChange={(next) => {
							setAccount(next)
							report.reset()
						}}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="mo-month">{t("report.monthly.month")}</Label>
					<Select value={String(Math.min(month, lastMonth))} onValueChange={(value) => setMonth(Number(value))}>
						<SelectTrigger id="mo-month" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Array.from({length: lastMonth}, (_, index) => index + 1).map((number) => (
								<SelectItem key={number} value={String(number)}>
									{monthName(number, persian, year, language)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="mo-year">{t("report.monthly.year")}</Label>
					<Select
						value={String(year)}
						onValueChange={(value) => {
							const next = Number(value)
							setYear(next)
							// The current year has no months past the current one.
							if (next === now.year && month > now.month) setMonth(now.month)
						}}
					>
						<SelectTrigger id="mo-year" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{years.map((candidate) => (
								<SelectItem key={candidate} value={String(candidate)}>
									{formatAmount(candidate, language).replace(/[,٬،]/g, "")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-end">
					<Button type="submit" disabled={!account || report.isPending}>
						{report.isPending ? t("report.monthly.loading") : t("report.monthly.show")}
					</Button>
				</div>
			</form>

			{report.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{report.error.message || t("report.monthly.failed")}
				</p>
			) : null}

			{report.data && shown ? (
				<section className="flex flex-col gap-4" aria-label={t("report.monthly.result")}>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="text-lg font-semibold">
							{monthName(shown.month, persian, shown.year, language)} {formatAmount(shown.year, language).replace(/[,٬،]/g, "")}
						</h2>
						<Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
							<Printer aria-hidden="true" />
							{t("report.monthly.print")}
						</Button>
					</div>
					<dl className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
						<div className="flex justify-between gap-3">
							<dt className="text-muted-foreground">{t("report.monthly.totalDeposit")}</dt>
							<dd className="font-semibold text-success">{money(report.data.totalDeposit)}</dd>
						</div>
						<div className="flex justify-between gap-3">
							<dt className="text-muted-foreground">{t("report.monthly.totalWithdrawal")}</dt>
							<dd className="font-semibold">{money(report.data.totalWithdrawal)}</dd>
						</div>
					</dl>

					<div className="overflow-x-auto">
						<div role="table" aria-label={t("report.monthly.calendar")} className="grid min-w-[56rem] grid-cols-7 gap-1">
							{weekdays.map((name, index) => (
								<div key={name} role="columnheader" className={cn("rounded-md bg-muted p-2 text-center text-xs font-semibold", weekendColumns.includes(index + 1) && "text-destructive")}>
									{name}
								</div>
							))}
							{cells.map((day, index) =>
								day === null ? (
									<div key={`blank-${String(index)}`} role="cell" className="rounded-md border border-dashed border-transparent" />
								) : (
									<div
										key={day.number}
										role="cell"
										className={cn("flex min-h-24 flex-col gap-1 rounded-md border bg-card p-2 text-xs", (day.isHoliday || weekendColumns.includes((index % 7) + 1)) && "bg-muted/50", day.isToday && "border-primary")}
									>
										<span className={cn("text-sm font-semibold", (day.isHoliday || weekendColumns.includes((index % 7) + 1)) && "text-destructive")}>{formatAmount(day.number, language)}</span>
										{day.transactionCount > 0 || day.deposit > 0 || day.withdrawal > 0 ? (
											<>
												<span className="text-muted-foreground">{t("report.monthly.count", {count: day.transactionCount})}</span>
												<button
													type="button"
													disabled={day.withdrawals.length === 0}
													className="flex flex-col text-start enabled:hover:underline disabled:cursor-default"
													onClick={() => setDetails({day, deposit: false})}
												>
													<span className="text-muted-foreground">{t("report.monthly.withdrawal")}</span>
													<span dir="ltr" className="font-medium">
														{formatAmount(day.withdrawal, language)}
													</span>
												</button>
												<button type="button" disabled={day.deposits.length === 0} className="flex flex-col text-start enabled:hover:underline disabled:cursor-default" onClick={() => setDetails({day, deposit: true})}>
													<span className="text-muted-foreground">{t("report.monthly.deposit")}</span>
													<span dir="ltr" className="font-medium text-success">
														{formatAmount(day.deposit, language)}
													</span>
												</button>
												<span className="text-muted-foreground">{t("report.monthly.balance")}</span>
												<span dir="ltr" className="font-medium">
													{formatAmount(day.balance, language)}
												</span>
											</>
										) : null}
									</div>
								),
							)}
						</div>
					</div>
				</section>
			) : null}

			{details && shown ? <DayDetails day={details.day} deposit={details.deposit} title={`${formatAmount(details.day.number, language)} ${monthName(shown.month, persian, shown.year, language)}`} onClose={() => setDetails(null)} /> : null}
		</div>
	)
}

function DayDetails({day, deposit, title, onClose}: {day: CalendarDay; deposit: boolean; title: string; onClose: () => void}) {
	const {t, i18n} = useTranslation()
	const list: DayStatement[] = deposit ? day.deposits : day.withdrawals
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-auto">
				<DialogHeader>
					<DialogTitle>{deposit ? t("report.monthly.depositsOf", {date: title}) : t("report.monthly.withdrawalsOf", {date: title})}</DialogTitle>
					<DialogDescription>{t("report.monthly.detailsHint")}</DialogDescription>
				</DialogHeader>
				<ul className="flex flex-col gap-3">
					{list.map((statement, index) => (
						<li key={`${statement.reference}-${String(index)}`} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
							<div className="flex flex-wrap justify-between gap-2">
								<span className="font-semibold">{`${formatAmount(statement.amount, i18n.language)} ${t("report.monthly.rial")}`}</span>
								<span dir="ltr" className="text-xs text-muted-foreground">
									{statement.time}
								</span>
							</div>
							{statement.description ? <p>{statement.description}</p> : null}
							{statement.reference ? (
								<span className="text-xs text-muted-foreground">
									{t("report.monthly.reference")}: <span dir="ltr">{statement.reference}</span>
								</span>
							) : null}
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	)
}
