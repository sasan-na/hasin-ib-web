import {useInfiniteQuery, useQuery} from "@tanstack/react-query"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {getEvents, getEventTypes, type EventFilter} from "@/features/report/api/events"
import {formatAmount} from "@/lib/format"
import {jalaliToIso, parseJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

const PAGE_SIZE = 20
const ALL = "all"
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const EMPTY: EventFilter = {source: "current", typeId: "", typeText: "", from: "", to: "", ip: "", description: ""}

type Errors = Partial<Record<"from" | "to" | "ip", string>>

/** What the user did in the bank and when: filter by kind, dates, address or words, in this bank's record or the old one's. */
export default function EventsPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const types = useQuery({queryKey: ["report", "event-types", language], queryFn: getEventTypes, staleTime: 10 * 60_000, retry: false})

	// What is typed, and what was last searched: results change only when the user searches.
	const [typeId, setTypeId] = React.useState("")
	const [typeText, setTypeText] = React.useState("")
	const [from, setFrom] = React.useState("")
	const [to, setTo] = React.useState("")
	const [ip, setIp] = React.useState("")
	const [description, setDescription] = React.useState("")
	const [source, setSource] = React.useState<EventFilter["source"]>("current")
	const [applied, setApplied] = React.useState<EventFilter>(EMPTY)
	const [errors, setErrors] = React.useState<Errors>({})

	const events = useInfiniteQuery({
		queryKey: ["report", "events", applied],
		queryFn: ({pageParam}) => getEvents(applied, pageParam, PAGE_SIZE),
		initialPageParam: 0,
		getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length * PAGE_SIZE : undefined),
		staleTime: 30_000,
		retry: false,
	})
	const rows = events.data?.pages.flatMap((page) => page.events) ?? []
	const total = events.data?.pages[0]?.total ?? 0
	const note = events.data?.pages[0]?.note ?? ""

	const search = (): void => {
		const found: Errors = {}
		let isoFrom = ""
		let isoTo = ""
		if (from.trim() !== "") {
			const parsed = parseJalali(from)
			const iso = parsed ? jalaliToIso(parsed) : null
			if (iso) isoFrom = iso
			else found.from = t("report.events.error.date")
		}
		if (to.trim() !== "") {
			const parsed = parseJalali(to)
			const iso = parsed ? jalaliToIso(parsed) : null
			if (iso) isoTo = iso
			else found.to = t("report.events.error.date")
		}
		if (isoFrom !== "" && isoTo !== "" && isoFrom > isoTo) found.to = t("report.events.error.order")
		if (ip.trim() !== "" && !IPV4.test(ip.trim())) found.ip = t("report.events.error.ip")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setApplied({source, typeId, typeText: typeText.trim(), from: isoFrom, to: isoTo, ip: ip.trim(), description: description.trim()})
	}

	const reset = (): void => {
		setTypeId("")
		setTypeText("")
		setFrom("")
		setTo("")
		setIp("")
		setDescription("")
		setErrors({})
		setApplied({...EMPTY, source})
	}

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-xs text-destructive">
				{message}
			</p>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("report.events.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportStatement.path}>{t("report.statement.title")}</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.reportMonthly.path}>{t("report.monthly.title")}</Link>
					</Button>
				</div>
			</div>

			<div className="flex gap-2" role="group" aria-label={t("report.events.source")}>
				<Button
					type="button"
					size="sm"
					variant={source === "current" ? "default" : "outline"}
					aria-pressed={source === "current"}
					onClick={() => {
						setSource("current")
						setApplied({...applied, source: "current", typeText: ""})
					}}
				>
					{t("report.events.current")}
				</Button>
				<Button
					type="button"
					size="sm"
					variant={source === "archive" ? "default" : "outline"}
					aria-pressed={source === "archive"}
					onClick={() => {
						setSource("archive")
						setApplied({...applied, source: "archive", typeId: ""})
					}}
				>
					{t("report.events.archive")}
				</Button>
			</div>

			<form
				className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2"
				onSubmit={(event) => {
					event.preventDefault()
					search()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ev-type">{t("report.events.type")}</Label>
					{source === "current" ? (
						types.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : (
							<Select value={typeId === "" ? ALL : typeId} onValueChange={(value) => setTypeId(value === ALL ? "" : value)}>
								<SelectTrigger id="ev-type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL}>{t("report.events.allTypes")}</SelectItem>
									{(types.data ?? []).map((type) => (
										<SelectItem key={type.id} value={String(type.id)}>
											{type.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)
					) : (
						<Input id="ev-type" value={typeText} placeholder={t("report.events.typeWord")} onChange={(event) => setTypeText(event.target.value)} />
					)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ev-description">{t("report.events.description")}</Label>
					<Input id="ev-description" value={description} onChange={(event) => setDescription(event.target.value)} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ev-from">{t("report.events.from")}</Label>
					<Input id="ev-from" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={from} aria-invalid={errors.from !== undefined} onChange={(event) => setFrom(normalizeDigits(event.target.value))} />
					{error(errors.from)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ev-to">{t("report.events.to")}</Label>
					<Input id="ev-to" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/12/29" value={to} aria-invalid={errors.to !== undefined} onChange={(event) => setTo(normalizeDigits(event.target.value))} />
					{error(errors.to)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="ev-ip">{t("report.events.ip")}</Label>
					<Input id="ev-ip" dir="ltr" inputMode="decimal" autoComplete="off" placeholder="192.168.0.1" value={ip} aria-invalid={errors.ip !== undefined} onChange={(event) => setIp(normalizeDigits(event.target.value))} />
					{error(errors.ip)}
				</div>
				<div className="flex items-end justify-end gap-2 sm:col-span-2">
					<Button type="button" variant="outline" onClick={reset}>
						{t("report.events.clear")}
					</Button>
					<Button type="submit">{t("report.events.search")}</Button>
				</div>
			</form>

			{events.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
			) : events.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{events.error.message || t("report.events.failed")}
				</p>
			) : (
				<>
					{note && source === "current" ? <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground">{note}</p> : null}
					{rows.length === 0 ? (
						<p className="rounded-2xl bg-card p-5 shadow-card text-sm text-muted-foreground">{t("report.events.empty")}</p>
					) : (
						<>
							<p className="text-sm text-muted-foreground">{t("report.events.count", {shown: formatAmount(rows.length, language), total: formatAmount(total, language)})}</p>
							<ul className="flex flex-col gap-3">
								{rows.map((event, index) => (
									<li key={`${String(event.id)}-${String(index)}`} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
										<div className="flex flex-wrap justify-between gap-2">
											<span className="text-sm font-semibold">{event.type}</span>
											<span dir="ltr" className="text-xs text-muted-foreground">
												{event.dateTime}
											</span>
										</div>
										{event.description ? <p className="text-sm">{event.description}</p> : null}
										{event.ip ? (
											<span dir="ltr" className="text-xs text-muted-foreground">
												{event.ip}
											</span>
										) : null}
									</li>
								))}
							</ul>
							{events.hasNextPage ? (
								<div className="flex justify-center">
									<Button type="button" variant="outline" disabled={events.isFetchingNextPage} onClick={() => void events.fetchNextPage()}>
										{events.isFetchingNextPage ? t("report.events.loading") : t("report.events.more")}
									</Button>
								</div>
							) : null}
						</>
					)}
				</>
			)}
		</div>
	)
}
