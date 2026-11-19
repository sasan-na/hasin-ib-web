import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
	calculateCredit,
	type CreditResult,
} from "@/features/account/api/credit-calculate"
import { loanOptionsOptions } from "@/features/account/api/credit-calculate.queries"
import { formatAmount } from "@/lib/format"
import { parseJalali, todayJalali } from "@/lib/jalali"
import { routeMap } from "@/app/routes"

type Errors = Partial<Record<"profit" | "period" | "start" | "end", string>>

function Figure({
	label,
	value,
	language,
	strong = false,
}: {
	label: string
	value: number | null
	language: string
	strong?: boolean
}) {
	const { t } = useTranslation()
	if (value === null) return null
	return (
		<div className="flex flex-col">
			<dt className="text-muted-foreground text-sm">{label}</dt>
			<dd
				className={
					strong
						? "text-2xl font-extrabold tabular-nums"
						: "text-base font-medium tabular-nums"
				}
			>
				{formatAmount(value, language)}{" "}
				<span className="text-muted-foreground text-sm font-normal">
					{t("account.rial")}
				</span>
			</dd>
		</div>
	)
}

/** How much facility (loan) an account qualifies for between two dates, from its balances over time. */
export default function CreditCalculatePage() {
	const { t, i18n } = useTranslation()
	const [params] = useSearchParams()
	const accountNumber = (params.get("accountNumber") ?? "").trim()
	const valid = /^\d{5,30}$/.test(accountNumber)

	const options = useQuery({
		...loanOptionsOptions(accountNumber),
		enabled: valid,
	})
	const [profit, setProfit] = useState<string | null>(null)
	const [period, setPeriod] = useState("")
	// What the user typed; until they type, the account's opening date and today are offered.
	const [typedStart, setTypedStart] = useState<string | null>(null)
	const [typedEnd, setTypedEnd] = useState<string | null>(null)
	const [errors, setErrors] = useState<Errors>({})

	const profitRates = useMemo(
		() =>
			[
				...new Set((options.data?.types ?? []).map((type) => type.profitRate)),
			].sort((a, b) => a - b),
		[options.data],
	)
	// With a single rate there is nothing to choose, so it is simply used (as in the legacy page).
	const chosenProfit =
		profit ?? (profitRates.length === 1 ? String(profitRates[0]) : "")
	const periods = (options.data?.types ?? []).filter(
		(type) => chosenProfit !== "" && String(type.profitRate) === chosenProfit,
	)
	const chosenPeriod =
		period !== "" && periods.some((type) => String(type.id) === period)
			? period
			: periods.length === 1
				? String(periods[0].id)
				: ""

	const start = typedStart ?? options.data?.openingDate ?? ""
	const end = typedEnd ?? todayJalali()

	const calculation = useMutation({ mutationFn: calculateCredit })
	const result: CreditResult | undefined = calculation.data

	if (!valid) return <Navigate to={routeMap.accountList.path} replace />
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const hasTypes = (options.data?.types.length ?? 0) > 0

	const submit = (): void => {
		const found: Errors = {}
		const from = parseJalali(start)
		const to = parseJalali(end)
		if (hasTypes && chosenProfit === "")
			found.profit = t("account.credit.error.profit")
		if (hasTypes && chosenPeriod === "")
			found.period = t("account.credit.error.period")
		if (!from) found.start = t("account.credit.error.date")
		if (!to) found.end = t("account.credit.error.date")
		if (from && to && from > to) found.end = t("account.credit.error.order")
		setErrors(found)
		if (Object.keys(found).length > 0 || !from || !to) return
		calculation.mutate({
			accountNumber,
			startDate: from,
			endDate: to,
			loanTypeId: chosenPeriod === "" ? null : Number(chosenPeriod),
		})
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("account.credit.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.accountList.path}>
						<BackIcon aria-hidden="true" />
						{t("account.info.back")}
					</Link>
				</Button>
			</div>

			<p className="text-muted-foreground text-sm">
				{t("account.credit.hint")}
			</p>

			<form
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<FlowLayout
					aside={
						<FlowSummary
							id="credit-summary"
							title={t("account.credit.summary")}
							amount={null}
							rows={[
								{ label: t("account.number"), value: accountNumber },
								{
									label: t("account.credit.profitRate"),
									value:
										chosenProfit !== ""
											? t("account.credit.profitLabel", {
													rate: formatAmount(
														Number(chosenProfit),
														i18n.language,
													),
												})
											: null,
								},
								{
									label: t("account.credit.repayment"),
									value:
										chosenPeriod !== ""
											? t("account.credit.monthsLabel", {
													months: formatAmount(
														periods.find(
															(type) => String(type.id) === chosenPeriod,
														)?.months ?? 0,
														i18n.language,
													),
												})
											: null,
								},
								{
									label: t("account.credit.startDate"),
									value: parseJalali(start) ? start : null,
								},
								{
									label: t("account.credit.endDate"),
									value: parseJalali(end) ? end : null,
								},
							]}
							reviewLabel={
								calculation.isPending
									? t("account.credit.calculating")
									: t("account.credit.calculate")
							}
							onReview={() => {
								if (
									!options.isPending &&
									!options.isError &&
									!calculation.isPending
								)
									submit()
							}}
						/>
					}
				>
					{options.isPending || options.isError || hasTypes ? (
						<StepSection
							id="credit-type-step"
							step={1}
							title={t("account.credit.typeStep")}
						>
							{options.isPending ? (
								<Skeleton className="h-9 w-full" />
							) : options.isError ? (
								<FieldError>{t("account.credit.optionsError")}</FieldError>
							) : (
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="flex flex-col gap-2">
										<Label htmlFor="credit-profit">
											{t("account.credit.profitRate")}
										</Label>
										<Select
											value={chosenProfit}
											disabled={profitRates.length < 2}
											onValueChange={(value) => {
												setProfit(value)
												setPeriod("")
												setErrors({})
											}}
										>
											<SelectTrigger
												id="credit-profit"
												className="h-11 w-full"
												aria-invalid={errors.profit !== undefined}
											>
												<SelectValue
													placeholder={t("account.credit.chooseProfit")}
												/>
											</SelectTrigger>
											<SelectContent>
												{profitRates.map((rate) => (
													<SelectItem key={rate} value={String(rate)}>
														{t("account.credit.profitLabel", {
															rate: formatAmount(rate, i18n.language),
														})}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{errors.profit ? (
											<FieldError>{errors.profit}</FieldError>
										) : null}
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor="credit-period">
											{t("account.credit.repayment")}
										</Label>
										<Select
											value={chosenPeriod}
											disabled={periods.length === 0}
											onValueChange={(value) => {
												setPeriod(value)
												setErrors({})
											}}
										>
											<SelectTrigger
												id="credit-period"
												className="h-11 w-full"
												aria-invalid={errors.period !== undefined}
											>
												<SelectValue
													placeholder={t("account.credit.chooseRepayment")}
												/>
											</SelectTrigger>
											<SelectContent>
												{periods.map((type) => (
													<SelectItem key={type.id} value={String(type.id)}>
														{t("account.credit.monthsLabel", {
															months: formatAmount(type.months, i18n.language),
														})}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{errors.period ? (
											<FieldError>{errors.period}</FieldError>
										) : null}
									</div>
								</div>
							)}
						</StepSection>
					) : null}

					<StepSection
						id="credit-dates-step"
						step={hasTypes || options.isPending || options.isError ? 2 : 1}
						title={t("account.credit.datesStep")}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="credit-start">
									{t("account.credit.startDate")}
								</Label>
								<Input
									id="credit-start"
									dir="ltr"
									inputMode="numeric"
									placeholder="1404/01/01"
									autoComplete="off"
									className="h-11 text-base"
									value={start}
									disabled={options.isPending}
									aria-invalid={errors.start !== undefined}
									onChange={(event) => {
										setTypedStart(event.target.value)
										setErrors({})
									}}
								/>
								{errors.start ? <FieldError>{errors.start}</FieldError> : null}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="credit-end">
									{t("account.credit.endDate")}
								</Label>
								<Input
									id="credit-end"
									dir="ltr"
									inputMode="numeric"
									placeholder="1404/01/01"
									autoComplete="off"
									className="h-11 text-base"
									value={end}
									aria-invalid={errors.end !== undefined}
									onChange={(event) => {
										setTypedEnd(event.target.value)
										setErrors({})
									}}
								/>
								{errors.end ? <FieldError>{errors.end}</FieldError> : null}
							</div>
						</div>
						<p className="text-muted-foreground text-sm">
							{t("account.credit.dateNote")}
						</p>
					</StepSection>
				</FlowLayout>
			</form>

			{calculation.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{calculation.error.message || t("account.credit.failed")}
					</AlertDescription>
				</Alert>
			) : null}

			{result ? (
				<section
					aria-labelledby="credit-result"
					className="bg-card shadow-card flex flex-col gap-4 rounded-2xl p-5"
				>
					<h2 id="credit-result" className="text-base font-semibold">
						{t("account.credit.result")}
					</h2>
					<dl className="grid gap-4 sm:grid-cols-2">
						{result.openingDate ? (
							<div className="flex flex-col">
								<dt className="text-muted-foreground text-sm">
									{t("account.credit.openingDate")}
								</dt>
								<dd dir="ltr" className="text-start tabular-nums">
									{result.openingDate}
								</dd>
							</div>
						) : null}
						{result.openingBranchCode ? (
							<div className="flex flex-col">
								<dt className="text-muted-foreground text-sm">
									{t("account.credit.branchCode")}
								</dt>
								<dd dir="ltr" className="text-start tabular-nums">
									{result.openingBranchCode}
								</dd>
							</div>
						) : null}
						<Figure
							label={t("account.credit.balance")}
							value={result.balance}
							language={i18n.language}
						/>
						<Figure
							label={t("account.credit.receivable")}
							value={result.receivable}
							language={i18n.language}
						/>
						<Figure
							label={t("account.credit.actualCredit")}
							value={result.actualCredit}
							language={i18n.language}
							strong
						/>
					</dl>

					{result.periods.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("account.credit.noPeriods")}
						</p>
					) : null}
					{result.periods.map((period, index) => (
						<div
							key={index}
							className="flex flex-col gap-3 rounded-md border p-4"
						>
							<h3 className="font-semibold">
								{t("account.credit.periodTitle", {
									index: formatAmount(index + 1, i18n.language),
								})}
							</h3>
							<dl className="grid gap-3 sm:grid-cols-2">
								{period.waitingMonths !== null ? (
									<div className="flex flex-col">
										<dt className="text-muted-foreground text-sm">
											{t("account.credit.waiting")}
										</dt>
										<dd>{formatAmount(period.waitingMonths, i18n.language)}</dd>
									</div>
								) : null}
								{period.from ? (
									<div className="flex flex-col">
										<dt className="text-muted-foreground text-sm">
											{t("account.credit.calcFrom")}
										</dt>
										<dd dir="ltr" className="text-start tabular-nums">
											{period.from}
										</dd>
									</div>
								) : null}
								{period.to ? (
									<div className="flex flex-col">
										<dt className="text-muted-foreground text-sm">
											{t("account.credit.calcTo")}
										</dt>
										<dd dir="ltr" className="text-start tabular-nums">
											{period.to}
										</dd>
									</div>
								) : null}
								<Figure
									label={t("account.credit.averageBalance")}
									value={period.averageBalance}
									language={i18n.language}
								/>
								<Figure
									label={t("account.credit.facility")}
									value={period.facilityAmount}
									language={i18n.language}
									strong
								/>
							</dl>
						</div>
					))}

					{import.meta.env.VITE_FACILITY_URL ? (
						<p className="text-muted-foreground text-sm">
							{t("account.credit.receiveHint")}{" "}
							<a
								href={import.meta.env.VITE_FACILITY_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="underline underline-offset-4"
							>
								{t("account.credit.receiveLink")}
							</a>
						</p>
					) : null}
				</section>
			) : null}
		</div>
	)
}
