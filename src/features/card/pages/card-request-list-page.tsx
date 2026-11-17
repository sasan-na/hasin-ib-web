import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {getCardRequests, type CardRequest} from "@/features/card/api/card-request"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {normalizeDigits} from "@/lib/normalize-digits"
import {formatAmount} from "@/lib/format"
import {daysAgoJalali, jalaliToIso, parseJalali, todayJalali} from "@/lib/jalali"

// The bank's service name that decides which accounts may be searched for card requests.
const SOURCE_SERVICE = "ViewCardRequests"
// Until the user picks dates, the last month is shown.
const DEFAULT_RANGE_DAYS = 30

type Mode = "date" | "number"
type Errors = Partial<Record<"source" | "from" | "to" | "number", string>>

function GiftDetails({request, language}: {request: CardRequest; language: string}) {
	const {t} = useTranslation()
	const gift = request.gift
	if (!gift) return null
	return (
		<div className="flex flex-col gap-4">
			<p className="text-sm">
				{t("card.requests.giftSummary", {
					amount: formatAmount(gift.totalAmount, language),
					count: formatAmount(gift.totalCount, language),
					account: gift.accountNumber,
				})}
			</p>
			{gift.lines.length > 0 ? (
				<table className="w-full text-sm">
					<thead>
						<tr className="text-muted-foreground">
							<th className="py-1 text-start font-normal">{t("card.requests.count")}</th>
							<th className="py-1 text-start font-normal">{t("card.requests.amount")}</th>
							<th className="py-1 text-start font-normal">{t("card.requests.total")}</th>
						</tr>
					</thead>
					<tbody>
						{gift.lines.map((line, index) => (
							<tr key={index} className="border-t tabular-nums">
								<td className="py-1">{formatAmount(line.count, language)}</td>
								<td className="py-1">{formatAmount(line.amount, language)}</td>
								<td className="py-1">{formatAmount(line.total, language)}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}
		</div>
	)
}

/** Look up the card requests of one account, by date range or by request number. */
export default function CardRequestListPage() {
	const {t, i18n} = useTranslation()
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [mode, setMode] = useState<Mode>("date")
	const [from, setFrom] = useState(() => daysAgoJalali(DEFAULT_RANGE_DAYS))
	const [to, setTo] = useState(() => todayJalali())
	const [requestNumber, setRequestNumber] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [details, setDetails] = useState<CardRequest | null>(null)

	const search = useMutation({mutationFn: getCardRequests})

	const submit = (): void => {
		const found: Errors = {}
		let fromIso: string | null = null
		let toIso: string | null = null
		if (!source) found.source = t("card.requests.error.source")
		if (mode === "number") {
			if (requestNumber.trim() === "") found.number = t("card.requests.error.number")
		} else {
			const parsedFrom = parseJalali(from)
			const parsedTo = parseJalali(to)
			fromIso = parsedFrom ? jalaliToIso(parsedFrom) : null
			toIso = parsedTo ? jalaliToIso(parsedTo) : null
			if (!fromIso) found.from = t("card.requests.error.date")
			if (!toIso) found.to = t("card.requests.error.date")
			if (fromIso && toIso && fromIso > toIso) found.to = t("card.requests.error.order")
		}
		setErrors(found)
		if (Object.keys(found).length > 0 || !source) return
		search.mutate({
			accountNumber: source.number,
			requestNumber: mode === "number" ? requestNumber.trim() : null,
			from: mode === "date" ? fromIso : null,
			to: mode === "date" ? toIso : null,
		})
	}

	const reset = (): void => {
		setSource(null)
		setMode("date")
		setFrom(daysAgoJalali(DEFAULT_RANGE_DAYS))
		setTo(todayJalali())
		setRequestNumber("")
		setErrors({})
		search.reset()
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.requests.title")}</h1>

			<form
				className="flex flex-col gap-5 rounded-lg border bg-card p-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="request-account">{t("card.requests.account")}</Label>
					<SourceAccountSelect
						id="request-account"
						serviceName={SOURCE_SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							setErrors({})
						}}
						invalid={errors.source !== undefined}
					/>
					{errors.source ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.source}
						</p>
					) : null}
				</div>

				<RadioGroup value={mode} onValueChange={(value) => setMode(value as Mode)} aria-label={t("card.requests.searchBy")} className="flex flex-col gap-4">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<RadioGroupItem id="mode-date" value="date" />
							<Label htmlFor="mode-date">{t("card.requests.byDate")}</Label>
						</div>
						<div className="grid gap-4 ps-7 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="request-from">{t("card.requests.from")}</Label>
								<Input
									id="request-from"
									dir="ltr"
									inputMode="numeric"
									placeholder="1404/01/01"
									autoComplete="off"
									value={from}
									disabled={mode !== "date"}
									aria-invalid={errors.from !== undefined}
									onChange={(event) => {
										setFrom(event.target.value)
										setErrors({})
									}}
								/>
								{errors.from ? (
									<p role="alert" className="text-sm text-destructive">
										{errors.from}
									</p>
								) : null}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="request-to">{t("card.requests.to")}</Label>
								<Input
									id="request-to"
									dir="ltr"
									inputMode="numeric"
									placeholder="1404/01/01"
									autoComplete="off"
									value={to}
									disabled={mode !== "date"}
									aria-invalid={errors.to !== undefined}
									onChange={(event) => {
										setTo(event.target.value)
										setErrors({})
									}}
								/>
								{errors.to ? (
									<p role="alert" className="text-sm text-destructive">
										{errors.to}
									</p>
								) : null}
							</div>
							<p className="text-sm text-muted-foreground sm:col-span-2">{t("card.requests.dateNote")}</p>
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<RadioGroupItem id="mode-number" value="number" />
							<Label htmlFor="mode-number">{t("card.requests.byNumber")}</Label>
						</div>
						<div className="flex flex-col gap-2 ps-7">
							<Label htmlFor="request-number">{t("card.requests.number")}</Label>
							<Input
								id="request-number"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								className="max-w-64"
								value={requestNumber}
								disabled={mode !== "number"}
								aria-invalid={errors.number !== undefined}
								onChange={(event) => {
									setRequestNumber(normalizeDigits(event.target.value).replace(/\D/g, ""))
									setErrors({})
								}}
							/>
							{errors.number ? (
								<p role="alert" className="text-sm text-destructive">
									{errors.number}
								</p>
							) : null}
						</div>
					</div>
				</RadioGroup>

				<div className="flex flex-wrap gap-2">
					<Button type="submit" disabled={search.isPending}>
						{search.isPending ? t("card.requests.searching") : t("card.requests.show")}
					</Button>
					<Button type="button" variant="outline" disabled={search.isPending} onClick={reset}>
						{t("card.requests.reset")}
					</Button>
				</div>
			</form>

			{search.isError ? (
				<Alert variant="destructive">
					<AlertDescription>{search.error.message || t("card.requests.failed")}</AlertDescription>
				</Alert>
			) : null}

			{search.isSuccess && search.data.length === 0 ? (
				<p role="status" className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
					{t("card.requests.noResult")}
				</p>
			) : null}

			{search.isSuccess && search.data.length > 0 ? (
				<section aria-labelledby="request-results" className="overflow-hidden rounded-lg border bg-card">
					<h2 id="request-results" className="border-b px-5 py-4 text-base font-semibold">
						{t("card.requests.list")}
					</h2>
					<ul className="divide-y">
						{search.data.map((request) => (
							<li key={`${request.reference}-${request.date}`} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
								<div className="flex min-w-0 flex-col gap-2">
									<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
										<h3 className="text-base font-semibold wrap-break-word">{request.type}</h3>
										<span dir="ltr" className="text-sm text-muted-foreground tabular-nums">
											{request.date}
										</span>
									</div>
									<dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
										<div className="flex flex-wrap gap-x-2">
											<dt className="text-muted-foreground">{t("card.requests.reference")}</dt>
											<dd dir="ltr" className="tabular-nums">
												{request.reference}
											</dd>
										</div>
										{request.branch ? (
											<div className="flex flex-wrap gap-x-2">
												<dt className="text-muted-foreground">{t("card.requests.branch")}</dt>
												<dd>{request.branch}</dd>
											</div>
										) : null}
										{request.issuingStatus ? (
											<div className="flex flex-wrap gap-x-2">
												<dt className="text-muted-foreground">{t("card.requests.issuing")}</dt>
												<dd>{request.issuingStatus}</dd>
											</div>
										) : null}
										{request.printingStatus ? (
											<div className="flex flex-wrap gap-x-2">
												<dt className="text-muted-foreground">{t("card.requests.printing")}</dt>
												<dd>{request.printingStatus}</dd>
											</div>
										) : null}
									</dl>
								</div>
								{request.gift ? (
									<div>
										<Button type="button" variant="outline" size="sm" onClick={() => setDetails(request)}>
											{t("card.requests.details")}
										</Button>
									</div>
								) : null}
							</li>
						))}
					</ul>
				</section>
			) : null}

			<Dialog open={details !== null} onOpenChange={(open) => (open ? undefined : setDetails(null))}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("card.requests.giftTitle", {number: details?.reference ?? ""})}</DialogTitle>
						<DialogDescription className="sr-only">{t("card.requests.giftTitle", {number: details?.reference ?? ""})}</DialogDescription>
					</DialogHeader>
					{details ? <GiftDetails request={details} language={i18n.language} /> : null}
				</DialogContent>
			</Dialog>
		</div>
	)
}
