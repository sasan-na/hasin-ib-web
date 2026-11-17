import {useInfiniteQuery, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {getOldDetails, getOldHistory, getOldServices, type OldFilter, type OldRecord} from "@/features/dashboard/api/old-history"
import {jalaliToIso, parseJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

const PAGE_SIZE = 10
const ALL = "all"
const EMPTY: OldFilter = {startFrom: "", startTo: "", endFrom: "", endTo: "", typeId: "", successful: true, failed: true}

/** Approvals from before the move to this internet bank: search them, and open one to see what it asked for. */
export default function OldHistoryPage() {
	const {t, i18n} = useTranslation()
	const services = useQuery({queryKey: ["dashboard", "old-services"], queryFn: getOldServices, staleTime: 10 * 60_000, retry: false})
	const [typeId, setTypeId] = useState("")
	const [startFrom, setStartFrom] = useState("")
	const [startTo, setStartTo] = useState("")
	const [endFrom, setEndFrom] = useState("")
	const [endTo, setEndTo] = useState("")
	const [successful, setSuccessful] = useState(true)
	const [failed, setFailed] = useState(true)
	const [applied, setApplied] = useState<OldFilter>(EMPTY)
	const [error, setError] = useState("")
	const [detail, setDetail] = useState<OldRecord | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const list = useInfiniteQuery({
		queryKey: ["dashboard", "old-history", applied],
		queryFn: ({pageParam}) => getOldHistory(applied, pageParam, PAGE_SIZE),
		initialPageParam: 0,
		getNextPageParam: (last, pages) => (last.more ? pages.length * PAGE_SIZE : undefined),
		staleTime: 30_000,
		retry: false,
	})
	const records = list.data?.pages.flatMap((page) => page.records) ?? []
	const note = list.data?.pages[0]?.note ?? ""

	const search = (): void => {
		const parse = (text: string): string | null | undefined => {
			if (text.trim() === "") return ""
			const parsed = parseJalali(text)
			return parsed ? jalaliToIso(parsed) : undefined
		}
		const values = [parse(startFrom), parse(startTo), parse(endFrom), parse(endTo)]
		if (values.some((value) => value === undefined || value === null)) return setError(t("dashboard.old.error.date"))
		if (!successful && !failed) return setError(t("dashboard.old.error.state"))
		setError("")
		setApplied({startFrom: values[0] as string, startTo: values[1] as string, endFrom: values[2] as string, endTo: values[3] as string, typeId, successful, failed})
	}

	const field = (id: string, label: string, value: string, set: (value: string) => void) => (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={value} onChange={(event) => set(normalizeDigits(event.target.value))} />
		</div>
	)

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("dashboard.old.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.dashboard.path}>
						<BackIcon aria-hidden="true" />
						{t("dashboard.rules.back")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("dashboard.old.hint")}</p>
			{note ? <p className="rounded-md border bg-muted/40 p-3 text-sm">{note}</p> : null}

			<form
				className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					search()
				}}
			>
				<div className="flex flex-col gap-2 sm:col-span-2">
					<Label htmlFor="oh-type">{t("dashboard.old.type")}</Label>
					<Select value={typeId === "" ? ALL : typeId} onValueChange={(value) => setTypeId(value === ALL ? "" : value)}>
						<SelectTrigger id="oh-type" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>{t("dashboard.old.allTypes")}</SelectItem>
							{(services.data ?? []).map((service) => (
								<SelectItem key={service.id} value={String(service.id)}>
									{service.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{field("oh-sf", t("dashboard.old.startFrom"), startFrom, setStartFrom)}
				{field("oh-st", t("dashboard.old.startTo"), startTo, setStartTo)}
				{field("oh-ef", t("dashboard.old.endFrom"), endFrom, setEndFrom)}
				{field("oh-et", t("dashboard.old.endTo"), endTo, setEndTo)}
				<div className="flex flex-wrap gap-6 sm:col-span-2">
					<div className="flex items-center gap-2">
						<Checkbox id="oh-ok" checked={successful} onCheckedChange={(checked) => setSuccessful(checked === true)} />
						<Label htmlFor="oh-ok">{t("dashboard.item.successful")}</Label>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox id="oh-bad" checked={failed} onCheckedChange={(checked) => setFailed(checked === true)} />
						<Label htmlFor="oh-bad">{t("dashboard.item.failed")}</Label>
					</div>
				</div>
				{error ? (
					<p role="alert" className="text-sm text-destructive sm:col-span-2">
						{error}
					</p>
				) : null}
				<div className="flex gap-2 sm:col-span-2">
					<Button type="submit">{t("dashboard.search")}</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							setTypeId("")
							setStartFrom("")
							setStartTo("")
							setEndFrom("")
							setEndTo("")
							setSuccessful(true)
							setFailed(true)
							setError("")
							setApplied(EMPTY)
						}}
					>
						{t("dashboard.clear")}
					</Button>
				</div>
			</form>

			{list.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : list.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{list.error.message || t("dashboard.old.loadError")}
				</p>
			) : records.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("dashboard.old.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{records.map((record) => (
						<li key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-5">
							<div className="flex flex-col gap-1 text-sm">
								<span className="font-semibold">{record.type}</span>
								<span dir="ltr" className="text-start text-muted-foreground">
									{record.started} → {record.ended}
								</span>
								<span className={record.successful ? "text-success" : "text-destructive"}>{record.successful ? t("dashboard.item.successful") : t("dashboard.item.failed")}</span>
							</div>
							<Button type="button" size="sm" variant="outline" onClick={() => setDetail(record)}>
								{t("dashboard.item.details")}
							</Button>
						</li>
					))}
				</ul>
			)}

			{list.hasNextPage ? (
				<div className="flex justify-center">
					<Button type="button" variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
						{list.isFetchingNextPage ? t("dashboard.loadingMore") : t("dashboard.loadMore")}
					</Button>
				</div>
			) : null}

			{detail ? <DetailsDialog record={detail} onClose={() => setDetail(null)} /> : null}
		</div>
	)
}

function DetailsDialog({record, onClose}: {record: OldRecord; onClose: () => void}) {
	const {t} = useTranslation()
	const details = useQuery({queryKey: ["dashboard", "old-details", record.id, record.typeId], queryFn: () => getOldDetails(record), retry: false})
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent className="max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{details.data?.name || record.type}</DialogTitle>
					<DialogDescription>{t("dashboard.old.detailsHint")}</DialogDescription>
				</DialogHeader>
				{details.isPending ? (
					<Skeleton className="h-32 w-full" />
				) : details.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{details.error.message || t("dashboard.details.error")}
					</p>
				) : (
					<div className="flex flex-col gap-4">
						<dl className="flex flex-col gap-2 text-sm">
							{details.data.fields.map((item, index) => (
								<div key={index} className="flex flex-wrap justify-between gap-2">
									<dt className="text-muted-foreground">{item.label}</dt>
									<dd className="font-medium wrap-break-word">{item.value}</dd>
								</div>
							))}
						</dl>
						{details.data.rows.length > 0 ? (
							<div className="overflow-x-auto rounded-md border">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											{details.data.headers.map((header, index) => (
												<th key={index} className="p-2 text-start font-medium text-muted-foreground">
													{header}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{details.data.rows.map((row, rowIndex) => (
											<tr key={rowIndex} className="border-b last:border-0">
												{row.map((cell, index) => (
													<td key={index} className="p-2">
														{cell}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</div>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						{t("dashboard.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
