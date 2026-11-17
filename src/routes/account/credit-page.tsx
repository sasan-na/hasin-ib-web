import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useMemo, useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {calculateCredit, type CreditResult} from "@/lib/api/creditCalculate"
import {loanOptionsOptions} from "@/lib/api/creditCalculate.queries"
import {formatAmount} from "@/lib/format"
import {parseJalali, todayJalali} from "@/lib/jalali"
import {routeMap} from "@/routing.tsx"

type Errors = Partial<Record<"profit" | "period" | "start" | "end", string>>

function Figure({label, value, language, strong = false}: {label: string; value: number | null; language: string; strong?: boolean}) {
	const {t} = useTranslation()
	if (value === null) return null
	return (
		<div className="flex flex-col">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className={strong ? "text-2xl font-extrabold tabular-nums" : "text-base font-medium tabular-nums"}>
				{formatAmount(value, language)} <span className="text-sm font-normal text-muted-foreground">{t("account.rial")}</span>
			</dd>
		</div>
	)
}

/** How much facility (loan) an account qualifies for between two dates, from its balances over time. */
export default function CreditCalculatePage() {
	const {t, i18n} = useTranslation()
	const [params] = useSearchParams()
	const accountNumber = (params.get("accountNumber") ?? "").trim()
	const valid = /^\d{5,30}$/.test(accountNumber)

	const options = useQuery({...loanOptionsOptions(accountNumber), enabled: valid})
	const [profit, setProfit] = useState<string | null>(null)
	const [period, setPeriod] = useState("")
	// What the user typed; until they type, the account's opening date and today are offered.
	const [typedStart, setTypedStart] = useState<string | null>(null)
	const [typedEnd, setTypedEnd] = useState<string | null>(null)
	const [errors, setErrors] = useState<Errors>({})

	const profitRates = useMemo(() => [...new Set((options.data?.types ?? []).map((type) => type.profitRate))].sort((a, b) => a - b), [options.data])
	// With a single rate there is nothing to choose, so it is simply used (as in the legacy page).
	const chosenProfit = profit ?? (profitRates.length === 1 ? String(profitRates[0]) : "")
	const periods = (options.data?.types ?? []).filter((type) => chosenProfit !== "" && String(type.profitRate) === chosenProfit)
	const chosenPeriod = period !== "" && periods.some((type) => String(type.id) === period) ? period : periods.length === 1 ? String(periods[0].id) : ""

	const start = typedStart ?? options.data?.openingDate ?? ""
	const end = typedEnd ?? todayJalali()

	const calculation = useMutation({mutationFn: calculateCredit})
	const result: CreditResult | undefined = calculation.data

	if (!valid) return <Navigate to={routeMap.accountList.path} replace />
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const hasTypes = (options.data?.types.length ?? 0) > 0

	const submit = (): void => {
		const found: Errors = {}
		const from = parseJalali(start)
		const to = parseJalali(end)
		if (hasTypes && chosenProfit === "") found.profit = t("account.credit.error.profit")
		if (hasTypes && chosenPeriod === "") found.period = t("account.credit.error.period")
		if (!from) found.start = t("account.credit.error.date")
		if (!to) found.end = t("account.credit.error.date")
		if (from && to && from > to) found.end = t("account.credit.error.order")
		setErrors(found)
		if (Object.keys(found).length > 0 || !from || !to) return
		calculation.mutate({accountNumber, startDate: from, endDate: to, loanTypeId: chosenPeriod === "" ? null : Number(chosenPeriod)})
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("account.credit.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.accountList.path}>
						<BackIcon aria-hidden="true" />
						{t("account.info.back")}
					</Link>
				</Button>
			</div>

			<p className="text-sm text-muted-foreground">{t("account.credit.hint")}</p>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<p className="text-sm">
					<span className="text-muted-foreground">{t("account.number")} </span>
					<span dir="ltr" className="tabular-nums">
						{accountNumber}
					</span>
				</p>

				{options.isPending ? (
					<Skeleton className="h-9 w-full" />
				) : options.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("account.credit.optionsError")}
					</p>
				) : hasTypes ? (
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="credit-profit">{t("account.credit.profitRate")}</Label>
							<Select
								value={chosenProfit}
								disabled={profitRates.length < 2}
								onValueChange={(value) => {
									setProfit(value)
									setPeriod("")
									setErrors({})
								}}
							>
								<SelectTrigger id="credit-profit" className="w-full" aria-invalid={errors.profit !== undefined}>
									<SelectValue placeholder={t("account.credit.chooseProfit")} />
								</SelectTrigger>
								<SelectContent>
									{profitRates.map((rate) => (
										<SelectItem key={rate} value={String(rate)}>
											{t("account.credit.profitLabel", {rate: formatAmount(rate, i18n.language)})}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.profit ? (
								<p role="alert" className="text-sm text-destructive">
									{errors.profit}
								</p>
							) : null}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="credit-period">{t("account.credit.repayment")}</Label>
							<Select
								value={chosenPeriod}
								disabled={periods.length === 0}
								onValueChange={(value) => {
									setPeriod(value)
									setErrors({})
								}}
							>
								<SelectTrigger id="credit-period" className="w-full" aria-invalid={errors.period !== undefined}>
									<SelectValue placeholder={t("account.credit.chooseRepayment")} />
								</SelectTrigger>
								<SelectContent>
									{periods.map((type) => (
										<SelectItem key={type.id} value={String(type.id)}>
											{t("account.credit.monthsLabel", {months: formatAmount(type.months, i18n.language)})}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.period ? (
								<p role="alert" className="text-sm text-destructive">
									{errors.period}
								</p>
							) : null}
						</div>
					</div>
				) : null}

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="credit-start">{t("account.credit.startDate")}</Label>
						<Input
							id="credit-start"
							dir="ltr"
							inputMode="numeric"
							placeholder="1404/01/01"
							autoComplete="off"
							value={start}
							disabled={options.isPending}
							aria-invalid={errors.start !== undefined}
							onChange={(event) => {
								setTypedStart(event.target.value)
								setErrors({})
							}}
						/>
						{errors.start ? (
							<p role="alert" className="text-sm text-destructive">
								{errors.start}
							</p>
						) : null}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="credit-end">{t("account.credit.endDate")}</Label>
						<Input
							id="credit-end"
							dir="ltr"
							inputMode="numeric"
							placeholder="1404/01/01"
							autoComplete="off"
							value={end}
							aria-invalid={errors.end !== undefined}
							onChange={(event) => {
								setTypedEnd(event.target.value)
								setErrors({})
							}}
						/>
						{errors.end ? (
							<p role="alert" className="text-sm text-destructive">
								{errors.end}
							</p>
						) : null}
					</div>
				</div>
				<p className="text-sm text-muted-foreground">{t("account.credit.dateNote")}</p>

				<div>
					<Button type="submit" disabled={options.isPending || options.isError || calculation.isPending}>
						{calculation.isPending ? t("account.credit.calculating") : t("account.credit.calculate")}
					</Button>
				</div>
			</form>

			{calculation.isError ? (
				<Alert variant="destructive">
					<AlertDescription>{calculation.error.message || t("account.credit.failed")}</AlertDescription>
				</Alert>
			) : null}

			{result ? (
				<section aria-labelledby="credit-result" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
					<h2 id="credit-result" className="text-base font-semibold">
						{t("account.credit.result")}
					</h2>
					<dl className="grid gap-4 sm:grid-cols-2">
						{result.openingDate ? (
							<div className="flex flex-col">
								<dt className="text-sm text-muted-foreground">{t("account.credit.openingDate")}</dt>
								<dd dir="ltr" className="text-start tabular-nums">
									{result.openingDate}
								</dd>
							</div>
						) : null}
						{result.openingBranchCode ? (
							<div className="flex flex-col">
								<dt className="text-sm text-muted-foreground">{t("account.credit.branchCode")}</dt>
								<dd dir="ltr" className="text-start tabular-nums">
									{result.openingBranchCode}
								</dd>
							</div>
						) : null}
						<Figure label={t("account.credit.balance")} value={result.balance} language={i18n.language} />
						<Figure label={t("account.credit.receivable")} value={result.receivable} language={i18n.language} />
						<Figure label={t("account.credit.actualCredit")} value={result.actualCredit} language={i18n.language} strong />
					</dl>

					{result.periods.length === 0 ? <p className="text-sm text-muted-foreground">{t("account.credit.noPeriods")}</p> : null}
					{result.periods.map((period, index) => (
						<div key={index} className="flex flex-col gap-3 rounded-md border p-4">
							<h3 className="font-semibold">{t("account.credit.periodTitle", {index: formatAmount(index + 1, i18n.language)})}</h3>
							<dl className="grid gap-3 sm:grid-cols-2">
								{period.waitingMonths !== null ? (
									<div className="flex flex-col">
										<dt className="text-sm text-muted-foreground">{t("account.credit.waiting")}</dt>
										<dd>{formatAmount(period.waitingMonths, i18n.language)}</dd>
									</div>
								) : null}
								{period.from ? (
									<div className="flex flex-col">
										<dt className="text-sm text-muted-foreground">{t("account.credit.calcFrom")}</dt>
										<dd dir="ltr" className="text-start tabular-nums">
											{period.from}
										</dd>
									</div>
								) : null}
								{period.to ? (
									<div className="flex flex-col">
										<dt className="text-sm text-muted-foreground">{t("account.credit.calcTo")}</dt>
										<dd dir="ltr" className="text-start tabular-nums">
											{period.to}
										</dd>
									</div>
								) : null}
								<Figure label={t("account.credit.averageBalance")} value={period.averageBalance} language={i18n.language} />
								<Figure label={t("account.credit.facility")} value={period.facilityAmount} language={i18n.language} strong />
							</dl>
						</div>
					))}

					{import.meta.env.VITE_FACILITY_URL ? (
						<p className="text-sm text-muted-foreground">
							{t("account.credit.receiveHint")}{" "}
							<a href={import.meta.env.VITE_FACILITY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
								{t("account.credit.receiveLink")}
							</a>
						</p>
					) : null}
				</section>
			) : null}
		</div>
	)
}
