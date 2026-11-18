import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {getBranchRequests, getBranchServices, type BranchFilter} from "@/features/branch/api/branch"
import {formatJalali, jalaliToIso, parseJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

const ALL = "all"
const EMPTY: BranchFilter = {reference: "", from: "", to: "", serviceType: "", accountNumber: ""}

/** Opens a PDF the bank sent as base64 in a new tab. */
const openPdf = (base64: string): void => {
	const clean = base64.replace(/^data:application\/pdf;base64,/, "")
	try {
		const bytes = Uint8Array.from(atob(clean), (char) => char.charCodeAt(0))
		window.open(URL.createObjectURL(new Blob([bytes], {type: "application/pdf"})), "_blank", "noopener")
	} catch {
		// A file that is not valid base64 simply does not open.
	}
}

/** What the user asked of the bank through its branch services, and how each request stands. */
export default function BranchRequestsPage() {
	const {t} = useTranslation()
	const services = useQuery({queryKey: ["branch", "services"], queryFn: getBranchServices, staleTime: 10 * 60_000, retry: false})
	const [reference, setReference] = useState("")
	const [serviceType, setServiceType] = useState("")
	const [from, setFrom] = useState("")
	const [to, setTo] = useState("")
	const [applied, setApplied] = useState<BranchFilter>(EMPTY)
	const [error, setError] = useState("")
	const requests = useQuery({queryKey: ["branch", "requests", applied], queryFn: () => getBranchRequests(applied), staleTime: 30_000, retry: false})

	const search = (): void => {
		const parse = (text: string): string | null | undefined => {
			if (text.trim() === "") return ""
			const parsed = parseJalali(text)
			return parsed ? jalaliToIso(parsed) : undefined
		}
		const isoFrom = parse(from)
		const isoTo = parse(to)
		if (isoFrom === undefined || isoFrom === null || isoTo === undefined || isoTo === null) return setError(t("branch.error.date"))
		if (isoFrom !== "" && isoTo !== "" && isoFrom > isoTo) return setError(t("branch.error.order"))
		setError("")
		setApplied({reference: reference.trim(), from: isoFrom, to: isoTo, serviceType, accountNumber: ""})
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("branch.requests.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("branch.requests.hint")}</p>

			<form
				className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2"
				noValidate
				onSubmit={(event) => {
					event.preventDefault()
					search()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="br-service">{t("branch.requests.service")}</Label>
					<Select value={serviceType === "" ? ALL : serviceType} onValueChange={(value) => setServiceType(value === ALL ? "" : value)}>
						<SelectTrigger id="br-service" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>{t("branch.requests.allServices")}</SelectItem>
							{(services.data ?? []).map((service) => (
								<SelectItem key={service.type} value={service.type}>
									{service.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="br-ref">{t("branch.requests.reference")}</Label>
					<Input id="br-ref" dir="ltr" autoComplete="off" maxLength={30} value={reference} onChange={(event) => setReference(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="br-from">{t("branch.requests.from")}</Label>
					<Input id="br-from" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={from} onChange={(event) => setFrom(normalizeDigits(event.target.value))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="br-to">{t("branch.requests.to")}</Label>
					<Input id="br-to" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={to} onChange={(event) => setTo(normalizeDigits(event.target.value))} />
				</div>
				{error ? (
					<p role="alert" className="text-sm text-destructive sm:col-span-2">
						{error}
					</p>
				) : null}
				<div className="flex gap-2 sm:col-span-2">
					<Button type="submit">{t("branch.requests.show")}</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							setReference("")
							setServiceType("")
							setFrom("")
							setTo("")
							setError("")
							setApplied(EMPTY)
						}}
					>
						{t("branch.requests.clear")}
					</Button>
				</div>
			</form>

			{requests.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : requests.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{requests.error.message || t("branch.requests.error")}
				</p>
			) : requests.data.length === 0 ? (
				<p className="rounded-2xl bg-card p-5 shadow-card text-sm text-muted-foreground">{t("branch.requests.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{requests.data.map((request, index) => (
						<li key={`${request.reference}-${index}`} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card">
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-base font-semibold">{request.service}</h2>
								<span className={request.status === "rejected" ? "text-xs font-medium text-destructive" : request.status === "confirmed" ? "text-xs font-medium text-success" : "text-xs font-medium text-muted-foreground"}>
									{t(`branch.status.${request.status}`)}
								</span>
							</div>
							<dl className="grid gap-1 text-sm sm:grid-cols-2">
								<div className="flex gap-2">
									<dt className="text-muted-foreground">{t("branch.requests.reference")}:</dt>
									<dd dir="ltr">{request.reference}</dd>
								</div>
								{request.date ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("branch.requests.date")}:</dt>
										<dd dir="ltr">{`${formatJalali(request.date)} ${request.date.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"})}`}</dd>
									</div>
								) : null}
								{request.trackingCode ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("branch.requests.tracking")}:</dt>
										<dd dir="ltr">{request.trackingCode}</dd>
									</div>
								) : null}
								{request.declineReason ? (
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("branch.requests.decline")}:</dt>
										<dd>{request.declineReason}</dd>
									</div>
								) : null}
								{request.description ? (
									<div className="flex gap-2 sm:col-span-2">
										<dt className="text-muted-foreground">{t("branch.requests.description")}:</dt>
										<dd>{request.description}</dd>
									</div>
								) : null}
							</dl>
							{request.details || request.file ? (
								<div className="flex flex-wrap gap-2">
									{request.details ? (
										<Button type="button" size="sm" variant="outline" onClick={() => openPdf(request.details)}>
											{t("branch.requests.details")}
										</Button>
									) : null}
									{request.file ? (
										<Button type="button" size="sm" variant="outline" onClick={() => openPdf(request.file)}>
											{t("branch.requests.file")}
										</Button>
									) : null}
								</div>
							) : null}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
