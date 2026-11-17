import {useMutation} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {getConnectedCardStatement, type CardMovement} from "@/features/card/api/connected-card"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {daysAgoJalali, formatJalali, jalaliToIso, parseJalali, todayJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

const PAGE_SIZE = 10
// The bank keeps connected card statements to a month at a time.
const MAX_DAYS = 30

interface Result {
	query: {from: string; to: string}
	movements: CardMovement[]
	total: number
	page: number
}

/** The credit movements on one connected card over a period of up to 30 days. */
export default function ConnectedCardStatementPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const [params] = useSearchParams()
	const accountNumber = (params.get("account") ?? "").trim()
	const pan = (params.get("card") ?? "").trim()
	const valid = /^\d{5,30}$/.test(accountNumber) && /^\d{16}$/.test(pan)
	const [from, setFrom] = useState(() => daysAgoJalali(7))
	const [to, setTo] = useState(() => todayJalali())
	const [error, setError] = useState("")
	const [result, setResult] = useState<Result | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const search = useMutation({
		mutationFn: (query: {from: string; to: string}) => getConnectedCardStatement({accountNumber, pan, ...query, page: 1, pageSize: PAGE_SIZE}),
		onSuccess: (page, query) => setResult({query, movements: page.movements, total: page.total, page: 1}),
	})
	const more = useMutation({
		mutationFn: (current: Result) => getConnectedCardStatement({accountNumber, pan, ...current.query, page: current.page + 1, pageSize: PAGE_SIZE}),
		onSuccess: (page, current) => setResult({...current, movements: [...current.movements, ...page.movements], total: page.total, page: current.page + 1}),
	})

	if (!valid) return <Navigate to={routeMap.cardConnected.path} replace />

	const run = (): void => {
		const parsedFrom = parseJalali(from)
		const parsedTo = parseJalali(to)
		const isoFrom = parsedFrom ? jalaliToIso(parsedFrom) : null
		const isoTo = parsedTo ? jalaliToIso(parsedTo) : null
		if (!parsedFrom || !parsedTo || !isoFrom || !isoTo) return setError(t("card.connected.statement.error.date"))
		if (isoFrom > isoTo) return setError(t("card.connected.statement.error.order"))
		if ((Date.parse(isoTo) - Date.parse(isoFrom)) / 86_400_000 > MAX_DAYS) return setError(t("card.connected.statement.error.period", {days: MAX_DAYS}))
		setError("")
		search.mutate({from: parsedFrom, to: parsedTo})
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("card.connected.statement.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.cardConnected.path}>
						<BackIcon aria-hidden="true" />
						{t("card.connected.again")}
					</Link>
				</Button>
			</div>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					run()
				}}
			>
				<dl className="flex flex-col gap-1 text-sm">
					<div className="flex gap-2">
						<dt className="text-muted-foreground">{t("card.connected.account")}:</dt>
						<dd dir="ltr">{accountNumber}</dd>
					</div>
					<div className="flex gap-2">
						<dt className="text-muted-foreground">{t("card.connected.card")}:</dt>
						<dd dir="ltr">{formatCardNumber(pan)}</dd>
					</div>
				</dl>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="ccs-from">{t("card.connected.statement.from")}</Label>
						<Input id="ccs-from" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={from} onChange={(event) => setFrom(normalizeDigits(event.target.value))} />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="ccs-to">{t("card.connected.statement.to")}</Label>
						<Input id="ccs-to" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={to} onChange={(event) => setTo(normalizeDigits(event.target.value))} />
					</div>
				</div>
				<p className="text-xs text-muted-foreground">{t("card.connected.statement.hint", {days: MAX_DAYS})}</p>
				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
				<div>
					<Button type="submit" disabled={search.isPending}>
						{search.isPending ? t("card.connected.loading") : t("card.connected.statement.show")}
					</Button>
				</div>
			</form>

			{search.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{search.error.message || t("card.connected.statement.failed")}
				</p>
			) : null}

			{result ? (
				result.movements.length === 0 ? (
					<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("card.connected.statement.empty")}</p>
				) : (
					<section className="rounded-lg border bg-card">
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b">
										<th className="p-3 text-start font-medium text-muted-foreground">{t("card.connected.statement.date")}</th>
										<th className="p-3 text-start font-medium text-muted-foreground">{t("card.connected.statement.kind")}</th>
										<th className="p-3 text-start font-medium text-muted-foreground">{t("card.connected.amount")}</th>
									</tr>
								</thead>
								<tbody>
									{result.movements.map((item, index) => (
										<tr key={index} className="border-b last:border-0">
											<td dir="ltr" className="p-3 text-start tabular-nums">
												{item.at ? `${formatJalali(item.at)} ${item.at.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"})}` : ""}
											</td>
											<td className={item.kind === "debit" ? "p-3 text-destructive" : item.kind === "credit" ? "p-3 text-success" : "p-3"}>
												{item.kind === "debit" ? t("card.connected.statement.debit") : item.kind === "credit" ? t("card.connected.statement.credit") : "—"}
											</td>
											<td className="p-3 tabular-nums">{`${formatAmount(item.amount, language)} ${t("card.connected.rial")}`}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
							<span>{t("card.connected.statement.count", {shown: result.movements.length, total: result.total})}</span>
							{result.movements.length < result.total ? (
								<Button type="button" variant="outline" disabled={more.isPending} onClick={() => more.mutate(result)}>
									{more.isPending ? t("card.connected.loading") : t("card.connected.statement.more")}
								</Button>
							) : null}
						</div>
						{more.isError ? (
							<p role="alert" className="px-4 pb-4 text-sm text-destructive">
								{more.error.message || t("card.connected.statement.failed")}
							</p>
						) : null}
					</section>
				)
			) : null}
		</div>
	)
}
