import {useMutation, useQuery} from "@tanstack/react-query"
import * as React from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {getBalanceDiagram, getValidPeriod} from "@/features/report/api/balance"
import {BalanceChart} from "@/features/report/components/balance-chart"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {formatAmount} from "@/lib/format"
import {formatJalali, jalaliToIso, parseJalali, todayJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the service: which accounts may be reported on.
const SERVICE = "AccountTotalStatement"

/** Today in the user's time zone, as "YYYY-MM-DD". */
const todayIso = (): string => new Date().toLocaleDateString("sv-SE")
/** The first day of the current month as "YYYY-MM-DD": the Persian month for Persian, the Gregorian one otherwise. */
const monthStartIso = (persian: boolean): string => (persian ? jalaliToIso(`${todayJalali().slice(0, 8)}01`) : null) ?? `${todayIso().slice(0, 8)}01`
const spanDays = (fromIso: string, toIso: string): number => Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86_400_000) + 1

/** How an account's balance moved over a stretch of days, drawn as a line. */
export default function BalancePage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const persian = language !== "en"
	const period = useQuery({queryKey: ["report", "balance-period"], queryFn: getValidPeriod, staleTime: 10 * 60_000, retry: false})

	const show = (iso: string): string => (persian ? formatJalali(new Date(`${iso}T12:00:00`)) : iso)
	// From the first day of this month (in the page's calendar) to today.
	const [account, setAccount] = React.useState<SourceAccount | null>(null)
	const [from, setFrom] = React.useState(() => show(monthStartIso(persian)))
	const [to, setTo] = React.useState(() => show(todayIso()))
	const [error, setError] = React.useState<string | null>(null)
	const [persianShown, setPersianShown] = React.useState(persian)

	const diagram = useMutation({
		mutationFn: (range: {from: string; to: string}) => getBalanceDiagram(account?.number ?? "", range.from, range.to),
	})

	const toIso = (value: string): string | null => {
		if (persian) {
			const parsed = parseJalali(value)
			return parsed ? jalaliToIso(parsed) : null
		}
		return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null
	}

	const submit = (): void => {
		setError(null)
		const fromIso = toIso(from)
		const toDate = toIso(to)
		if (!account) return setError(t("report.balance.error.account"))
		if (!fromIso || !toDate) return setError(t("report.balance.error.date"))
		if (fromIso > toDate) return setError(t("report.balance.error.order"))
		if (toDate > todayIso()) return setError(t("report.balance.error.future"))
		const limit = period.data ?? 90
		if (spanDays(fromIso, toDate) > limit) return setError(t("report.balance.error.period", {days: formatAmount(limit, language)}))
		setPersianShown(persian)
		diagram.mutate({from: fromIso, to: toDate})
	}

	const days = diagram.data?.days ?? []
	const totalDeposit = days.reduce((sum, day) => sum + day.deposit, 0)
	const totalWithdrawal = days.reduce((sum, day) => sum + day.withdrawal, 0)
	const money = (value: number): string => `${formatAmount(value, language)} ${t("report.balance.rial")}`

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("report.balance.title")}</h1>

			<form
				className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2"
				onSubmit={(event) => {
					event.preventDefault()
					if (!diagram.isPending) submit()
				}}
			>
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Label htmlFor="bd-account">{t("report.statement.account")}</Label>
					<SourceAccountSelect
						id="bd-account"
						serviceName={SERVICE}
						value={account?.id ?? null}
						onChange={(next) => {
							setAccount(next)
							diagram.reset()
						}}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bd-from">{persian ? t("report.balance.fromPersian") : t("report.balance.from")}</Label>
					<Input id="bd-from" dir="ltr" inputMode="numeric" autoComplete="off" value={from} onChange={(event) => setFrom(normalizeDigits(event.target.value))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bd-to">{persian ? t("report.balance.toPersian") : t("report.balance.to")}</Label>
					<Input id="bd-to" dir="ltr" inputMode="numeric" autoComplete="off" value={to} onChange={(event) => setTo(normalizeDigits(event.target.value))} />
				</div>
				{period.data ? <p className="text-xs text-muted-foreground sm:col-span-2">{t("report.balance.limit", {days: formatAmount(period.data, language)})}</p> : null}
				{error ? (
					<p role="alert" className="text-sm text-destructive sm:col-span-2">
						{error}
					</p>
				) : null}
				<div className="sm:col-span-2">
					<Button type="submit" disabled={diagram.isPending}>
						{diagram.isPending ? t("report.balance.loading") : t("report.balance.show")}
					</Button>
				</div>
			</form>

			{diagram.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{diagram.error.message || t("report.balance.failed")}
				</p>
			) : null}

			{diagram.data ? (
				days.length === 0 ? (
					<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{diagram.data.note || t("report.balance.empty")}</p>
				) : (
					<section className="flex flex-col gap-4" aria-label={t("report.balance.result")}>
						<dl className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
							<div className="flex justify-between gap-3">
								<dt className="text-muted-foreground">{t("report.balance.totalDeposit")}</dt>
								<dd className="font-semibold text-success">{money(totalDeposit)}</dd>
							</div>
							<div className="flex justify-between gap-3">
								<dt className="text-muted-foreground">{t("report.balance.totalWithdrawal")}</dt>
								<dd className="font-semibold">{money(totalWithdrawal)}</dd>
							</div>
						</dl>
						<div className="rounded-lg border bg-card p-4">
							<BalanceChart days={days} persian={persianShown} />
						</div>
						<details className="rounded-lg border bg-card p-4">
							<summary className="cursor-pointer text-sm font-medium">{t("report.balance.table")}</summary>
							<div className="mt-3 overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="text-muted-foreground">
											<th className="py-1 text-start font-normal">{t("report.balance.day")}</th>
											<th className="py-1 text-start font-normal">{t("report.balance.balance")}</th>
											<th className="py-1 text-start font-normal">{t("report.balance.deposits")}</th>
											<th className="py-1 text-start font-normal">{t("report.balance.withdrawals")}</th>
										</tr>
									</thead>
									<tbody>
										{days.map((day) => (
											<tr key={day.date} className="border-t tabular-nums">
												<td className="py-1" dir="ltr">
													{persianShown ? formatJalali(new Date(`${day.date}T12:00:00`)) : day.date}
												</td>
												<td className="py-1">{formatAmount(day.balance, language)}</td>
												<td className="py-1">{formatAmount(day.deposit, language)}</td>
												<td className="py-1">{formatAmount(day.withdrawal, language)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</details>
					</section>
				)
			) : null}
		</div>
	)
}
