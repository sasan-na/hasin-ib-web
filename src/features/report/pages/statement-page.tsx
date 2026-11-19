import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import { StepSection } from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { accountsOptions } from "@/features/account/api/account.queries"
import {
	exportStatement,
	getStatement,
	type StatementExportFormat,
	type StatementPage,
	type StatementQuery,
	type StatementRow,
} from "@/features/report/api/statement"
import { statementTypesOptions } from "@/features/report/api/report.queries"
import { saveFile } from "@/lib/save-file"
import { formatAmount } from "@/lib/format"
import {
	daysAgoJalali,
	jalaliToIso,
	parseJalali,
	todayJalali,
} from "@/lib/jalali"
import { normalizeDigits } from "@/lib/normalize-digits"

const PAGE_SIZE = 20
const DEFAULT_RANGE_DAYS = 30
const DEFAULT_LATEST = 10
const MAX_LATEST = 100

type Mode = "date" | "latest"
type Errors = Partial<
	Record<"account" | "type" | "from" | "to" | "latest" | "kind", string>
>

interface Result {
	query: StatementQuery
	rows: StatementRow[]
	total: number
	totalDebit: number | null
	totalCredit: number | null
}

/** An account's statement: what went in and out over a period, or its latest transactions, a page at a time. */
export default function StatementPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const accounts = useQuery(accountsOptions(language))

	const [accountId, setAccountId] = useState("")
	const [typeKey, setTypeKey] = useState("")
	const [mode, setMode] = useState<Mode>("date")
	const [from, setFrom] = useState(() => daysAgoJalali(DEFAULT_RANGE_DAYS))
	const [to, setTo] = useState(() => todayJalali())
	const [latest, setLatest] = useState(String(DEFAULT_LATEST))
	const [showDebit, setShowDebit] = useState(true)
	const [showCredit, setShowCredit] = useState(true)
	const [errors, setErrors] = useState<Errors>({})
	const [result, setResult] = useState<Result | null>(null)

	const account = accounts.data?.find(
		(candidate) => String(candidate.id) === accountId,
	)
	const types = useQuery(statementTypesOptions(account?.id ?? null))
	// The only kind of statement is chosen for the user; with several, the first is the default.
	const effectiveType =
		typeKey !== "" && types.data?.some((type) => type.key === typeKey)
			? typeKey
			: (types.data?.[0]?.key ?? "")

	const search = useMutation({
		mutationFn: (query: StatementQuery): Promise<StatementPage> =>
			getStatement(query, 0, PAGE_SIZE),
		onSuccess: (page, query) => setResult({ query, ...page }),
	})
	const more = useMutation({
		mutationFn: (current: Result): Promise<StatementPage> =>
			getStatement(current.query, current.rows.length, PAGE_SIZE),
		onSuccess: (page, current) =>
			setResult({
				...current,
				rows: [...current.rows, ...page.rows],
				total: page.total,
			}),
	})

	const exporting = useMutation({
		mutationFn: async (input: {
			current: Result
			format: StatementExportFormat
		}): Promise<void> => {
			const file = await exportStatement(
				input.current.query,
				input.format,
				input.current.total,
			)
			saveFile(file.blob, file.fileName)
		},
	})

	const run = (): void => {
		const found: Errors = {}
		if (!account) found.account = t("report.statement.error.account")
		if (effectiveType === "") found.type = t("report.statement.error.type")
		if (!showDebit && !showCredit) found.kind = t("report.statement.error.kind")
		let period: StatementQuery["period"] | null = null
		if (mode === "date") {
			const parsedFrom = parseJalali(from)
			const parsedTo = parseJalali(to)
			const isoFrom = parsedFrom ? jalaliToIso(parsedFrom) : null
			const isoTo = parsedTo ? jalaliToIso(parsedTo) : null
			if (!parsedFrom || !isoFrom) found.from = t("report.statement.error.date")
			if (!parsedTo || !isoTo) found.to = t("report.statement.error.date")
			if (parsedFrom && parsedTo && isoFrom && isoTo) {
				if (isoFrom > isoTo) found.to = t("report.statement.error.order")
				else
					period = {
						from: isoFrom,
						to: isoTo,
						fromJalali: parsedFrom,
						toJalali: parsedTo,
					}
			}
		} else {
			const count = Number(normalizeDigits(latest))
			if (!Number.isInteger(count) || count < 1 || count > MAX_LATEST)
				found.latest = t("report.statement.error.latest", { max: MAX_LATEST })
			else period = { latest: count }
		}
		setErrors(found)
		if (Object.keys(found).length > 0 || !account || !period) return
		setResult(null)
		more.reset()
		search.mutate({
			accountNumber: account.number,
			typeKey: effectiveType,
			period,
			showDebit,
			showCredit,
		})
	}

	const money = (value: number): string => formatAmount(value, language)
	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-destructive text-sm">
				{message}
			</p>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("report.statement.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportBalance.path}>
							{t("report.balance.title")}
						</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportMonthly.path}>
							{t("report.monthly.title")}
						</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportPeriodic.path}>
							{t("report.periodic.title")}
						</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportEvents.path}>
							{t("report.events.title")}
						</Link>
					</Button>
				</div>
			</div>

			<form
				noValidate
				className="flex flex-col gap-5"
				onSubmit={(event) => {
					event.preventDefault()
					run()
				}}
			>
				<StepSection
					id="st-account-step"
					step={1}
					title={t("report.statement.accountStep")}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="st-account">
								{t("report.statement.account")}
							</Label>
							{accounts.isPending ? (
								<Skeleton className="h-9 w-full" />
							) : accounts.isError ? (
								error(t("report.statement.accountsError"))
							) : (
								<Select
									value={accountId}
									onValueChange={(value) => {
										setAccountId(value)
										setTypeKey("")
										setErrors({})
									}}
								>
									<SelectTrigger
										id="st-account"
										className="w-full"
										aria-invalid={errors.account !== undefined}
									>
										<SelectValue
											placeholder={t("report.statement.chooseAccount")}
										/>
									</SelectTrigger>
									<SelectContent>
										{accounts.data.map((candidate) => (
											<SelectItem
												key={candidate.id}
												value={String(candidate.id)}
											>
												<span>{candidate.name || candidate.type}</span>{" "}
												<span dir="ltr">{candidate.number}</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
							{error(errors.account)}
						</div>
						{account && (types.data?.length ?? 0) > 1 ? (
							<div className="flex flex-col gap-2">
								<Label htmlFor="st-type">{t("report.statement.type")}</Label>
								<Select value={effectiveType} onValueChange={setTypeKey}>
									<SelectTrigger id="st-type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{types.data?.map((type) => (
											<SelectItem key={type.key} value={type.key}>
												{type.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : null}
					</div>
					{account && types.isError
						? error(t("report.statement.typesError"))
						: null}
					{error(errors.type)}
				</StepSection>

				<StepSection
					id="st-range-step"
					step={2}
					title={t("report.statement.rangeStep")}
				>
					<RadioGroup
						value={mode}
						onValueChange={(value) =>
							setMode(value === "latest" ? "latest" : "date")
						}
						className="flex flex-wrap gap-6"
					>
						<div className="flex items-center gap-2">
							<RadioGroupItem id="st-mode-date" value="date" />
							<Label htmlFor="st-mode-date" className="font-normal">
								{t("report.statement.byDate")}
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem id="st-mode-latest" value="latest" />
							<Label htmlFor="st-mode-latest" className="font-normal">
								{t("report.statement.byLatest")}
							</Label>
						</div>
					</RadioGroup>

					{mode === "date" ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="st-from">{t("report.statement.from")}</Label>
								<Input
									id="st-from"
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									placeholder="1405/01/01"
									value={from}
									aria-invalid={errors.from !== undefined}
									onChange={(event) => setFrom(event.target.value)}
								/>
								{error(errors.from)}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="st-to">{t("report.statement.to")}</Label>
								<Input
									id="st-to"
									dir="ltr"
									inputMode="numeric"
									autoComplete="off"
									placeholder="1405/01/01"
									value={to}
									aria-invalid={errors.to !== undefined}
									onChange={(event) => setTo(event.target.value)}
								/>
								{error(errors.to)}
							</div>
						</div>
					) : (
						<div className="flex max-w-48 flex-col gap-2">
							<Label htmlFor="st-latest">
								{t("report.statement.latestCount")}
							</Label>
							<Input
								id="st-latest"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={3}
								value={latest}
								aria-invalid={errors.latest !== undefined}
								onChange={(event) => setLatest(event.target.value)}
							/>
							{error(errors.latest)}
						</div>
					)}

					<div className="flex flex-wrap items-center gap-6">
						<div className="flex items-center gap-2">
							<Checkbox
								id="st-debit"
								checked={showDebit}
								onCheckedChange={(checked) => setShowDebit(checked === true)}
							/>
							<Label htmlFor="st-debit" className="font-normal">
								{t("report.statement.withdrawals")}
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="st-credit"
								checked={showCredit}
								onCheckedChange={(checked) => setShowCredit(checked === true)}
							/>
							<Label htmlFor="st-credit" className="font-normal">
								{t("report.statement.deposits")}
							</Label>
						</div>
					</div>
					{error(errors.kind)}

					<div>
						<Button type="submit" disabled={search.isPending}>
							{search.isPending
								? t("report.statement.loading")
								: t("report.statement.show")}
						</Button>
					</div>
				</StepSection>
			</form>

			{search.isError ? (
				<p
					role="alert"
					className="bg-card shadow-card text-destructive rounded-2xl p-5 text-sm"
				>
					{search.error.message || t("report.statement.failed")}
				</p>
			) : null}

			{result ? (
				result.rows.length === 0 ? (
					<p className="bg-card shadow-card text-muted-foreground rounded-2xl p-5 text-sm">
						{t("report.statement.empty")}
					</p>
				) : (
					<section
						aria-label={t("report.statement.title")}
						className="bg-card overflow-hidden rounded-lg"
					>
						{result.totalDebit !== null || result.totalCredit !== null ? (
							<dl className="flex flex-wrap gap-x-8 gap-y-2 border-b p-5 text-sm">
								{result.totalDebit !== null ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">
											{t("report.statement.totalDebit")}
										</dt>
										<dd className="font-semibold tabular-nums">
											{money(result.totalDebit)}
										</dd>
									</div>
								) : null}
								{result.totalCredit !== null ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">
											{t("report.statement.totalCredit")}
										</dt>
										<dd className="font-semibold tabular-nums">
											{money(result.totalCredit)}
										</dd>
									</div>
								) : null}
							</dl>
						) : null}
						<ul className="divide-y">
							{result.rows.map((row, index) => (
								<li
									key={`${row.date}-${row.time}-${index}`}
									className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
								>
									<div className="flex min-w-0 flex-col gap-1">
										<span
											dir="ltr"
											className="text-muted-foreground text-sm tabular-nums"
										>
											{[row.date, row.time].filter(Boolean).join(" ")}
										</span>
										{row.description ? (
											<span className="text-sm wrap-break-word">
												{row.description}
											</span>
										) : null}
										{row.references.length > 0 ? (
											<span dir="ltr" className="text-muted-foreground text-xs">
												{row.references.join(" · ")}
											</span>
										) : null}
									</div>
									<div className="flex shrink-0 flex-col gap-0.5 text-sm tabular-nums sm:items-end">
										{row.debit ? (
											<span className="text-destructive font-semibold">
												− {money(row.debit)}
											</span>
										) : null}
										{row.credit ? (
											<span className="text-success font-semibold">
												+ {money(row.credit)}
											</span>
										) : null}
										{row.balance !== null ? (
											<span className="text-muted-foreground text-xs">
												{t("report.statement.balance")} {money(row.balance)}
											</span>
										) : null}
									</div>
								</li>
							))}
						</ul>
						<div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
							<span>
								{t("report.statement.count", {
									shown: result.rows.length,
									total: result.total,
								})}
							</span>
							{result.rows.length < result.total ? (
								<Button
									type="button"
									variant="outline"
									disabled={more.isPending}
									onClick={() => more.mutate(result)}
								>
									{more.isPending
										? t("report.statement.loading")
										: t("report.statement.more")}
								</Button>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-2 border-t p-4">
							<span className="text-muted-foreground text-sm">
								{t("report.statement.export")}
							</span>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={exporting.isPending}
								onClick={() =>
									exporting.mutate({ current: result, format: "pdf" })
								}
							>
								PDF
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={exporting.isPending}
								onClick={() =>
									exporting.mutate({ current: result, format: "excel" })
								}
							>
								Excel
							</Button>
							{exporting.isError ? (
								<span role="alert" className="text-destructive text-sm">
									{t("report.statement.exportFailed")}
								</span>
							) : null}
						</div>
						{more.isError ? (
							<p role="alert" className="text-destructive px-5 pb-4 text-sm">
								{more.error.message || t("report.statement.failed")}
							</p>
						) : null}
					</section>
				)
			) : null}
		</div>
	)
}
