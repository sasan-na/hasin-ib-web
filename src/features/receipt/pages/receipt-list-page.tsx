import {useInfiniteQuery, useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {getReceiptDates, getReceiptTypes, getReceipts, type ReceiptFilter} from "@/features/receipt/api/receipt"
import {formatJalali, jalaliToIso, parseJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

const PAGE_SIZE = 10
const ALL = "all"

/** The receipts of what the user did in the bank: search by kind, dates or reference number, then open one to read or print. */
export default function ReceiptListPage() {
	const {t, i18n} = useTranslation()
	const types = useQuery({queryKey: ["receipt", "types", i18n.language], queryFn: getReceiptTypes, staleTime: 10 * 60_000, retry: false})
	const dates = useQuery({queryKey: ["receipt", "dates"], queryFn: getReceiptDates, staleTime: 10 * 60_000, retry: false})

	const [typeId, setTypeId] = useState("")
	const [typedFrom, setTypedFrom] = useState<string | null>(null)
	const [typedTo, setTypedTo] = useState<string | null>(null)
	const [reference, setReference] = useState("")
	const [applied, setApplied] = useState<ReceiptFilter | null>(null)
	const [error, setError] = useState("")

	// Until the user types, the bank's own default window is offered.
	const iso = (value: string): string => (value === "" ? "" : formatJalali(new Date(`${value}T12:00:00`)))
	const from = typedFrom ?? (dates.data ? iso(dates.data.from) : "")
	const to = typedTo ?? (dates.data ? iso(dates.data.to) : "")

	// The first search runs by itself with the default window.
	const filter: ReceiptFilter | null = applied ?? (dates.data ? {typeId: "", from: dates.data.from, to: dates.data.to, reference: ""} : null)
	const receipts = useInfiniteQuery({
		queryKey: ["receipt", "list", filter],
		queryFn: ({pageParam}) => getReceipts(filter as ReceiptFilter, pageParam),
		initialPageParam: 0,
		getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length * PAGE_SIZE : undefined),
		enabled: filter !== null,
		staleTime: 30_000,
		retry: false,
	})
	const rows = receipts.data?.pages.flatMap((page) => page.rows) ?? []

	const search = (): void => {
		const parse = (text: string): string | null | undefined => {
			if (text.trim() === "") return ""
			const parsed = parseJalali(text)
			return parsed ? jalaliToIso(parsed) : undefined
		}
		const isoFrom = parse(from)
		const isoTo = parse(to)
		if (isoFrom === undefined || isoFrom === null || isoTo === undefined || isoTo === null) return setError(t("receipt.error.date"))
		if (isoFrom !== "" && isoTo !== "" && isoFrom > isoTo) return setError(t("receipt.error.order"))
		setError("")
		setApplied({typeId, from: isoFrom, to: isoTo, reference: reference.trim()})
	}

	const clear = (): void => {
		setTypeId("")
		setTypedFrom(null)
		setTypedTo(null)
		setReference("")
		setError("")
		setApplied(null)
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("receipt.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("receipt.hint")}</p>

			<form
				className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					search()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="receipt-type">{t("receipt.type")}</Label>
					<Select value={typeId === "" ? ALL : typeId} onValueChange={(value) => setTypeId(value === ALL ? "" : value)}>
						<SelectTrigger id="receipt-type" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>{t("receipt.allTypes")}</SelectItem>
							{(types.data ?? []).map((type) => (
								<SelectItem key={type.id} value={String(type.id)}>
									{type.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="receipt-reference">{t("receipt.reference")}</Label>
					<Input id="receipt-reference" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={20} value={reference} onChange={(event) => setReference(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="receipt-from">{t("receipt.from")}</Label>
					<Input id="receipt-from" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={from} onChange={(event) => setTypedFrom(normalizeDigits(event.target.value))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="receipt-to">{t("receipt.to")}</Label>
					<Input id="receipt-to" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={to} onChange={(event) => setTypedTo(normalizeDigits(event.target.value))} />
				</div>
				{error ? (
					<p role="alert" className="text-sm text-destructive sm:col-span-2">
						{error}
					</p>
				) : null}
				<div className="flex gap-2 sm:col-span-2">
					<Button type="submit">{t("receipt.search")}</Button>
					<Button type="button" variant="outline" onClick={clear}>
						{t("receipt.clear")}
					</Button>
				</div>
			</form>

			<p className="text-xs text-muted-foreground">{t("receipt.limitation")}</p>

			{filter === null || receipts.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : receipts.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{receipts.error.message || t("receipt.loadError")}
				</p>
			) : rows.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("receipt.notFound")}</p>
			) : (
				<div className="overflow-x-auto rounded-lg border bg-card">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b">
								<th className="p-3 text-start font-medium text-muted-foreground">{t("receipt.type")}</th>
								<th className="p-3 text-start font-medium text-muted-foreground">{t("receipt.time")}</th>
								<th className="p-3 text-start font-medium text-muted-foreground">{t("receipt.reference")}</th>
								<th className="p-3" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={`${row.id}-${row.batchId}`} className="border-b last:border-0">
									<td className="p-3">{row.type}</td>
									<td dir="ltr" className="p-3 text-start tabular-nums">
										{row.dateTime}
									</td>
									<td dir="ltr" className="p-3 text-start tabular-nums">
										{row.reference}
									</td>
									<td className="p-3 text-end">
										<Button asChild size="sm" variant="outline">
											<Link to={`${routeMap.receiptView.path}?${new URLSearchParams({id: String(row.id), type: row.typeKey, batch: row.batchId, isBatch: row.isBatch ? "1" : "0"}).toString()}`}>{t("receipt.view")}</Link>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{receipts.hasNextPage ? (
				<div className="flex justify-center">
					<Button type="button" variant="outline" disabled={receipts.isFetchingNextPage} onClick={() => void receipts.fetchNextPage()}>
						{receipts.isFetchingNextPage ? t("receipt.loadingMore") : t("receipt.loadMore")}
					</Button>
				</div>
			) : null}
		</div>
	)
}
