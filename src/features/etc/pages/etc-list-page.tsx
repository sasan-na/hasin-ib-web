import {useQuery} from "@tanstack/react-query"
import {RefreshCw} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {getEtcBalance, getEtcInfo, type Etc, type Plate} from "@/features/etc/api/etc"
import {etcListOptions} from "@/features/etc/api/etc.queries"
import {EtcOperationDialog} from "@/features/etc/components/etc-operation-dialog"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

const plateText = (plate: Plate | null): string => (plate ? `${plate.left} ${plate.letter} ${plate.middle} - ${plate.right}` : "")

/** The user's toll tags: look up a tag's balance and registered details, or deactivate or block it. */
export default function EtcListPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const tags = useQuery(etcListOptions())
	const [search, setSearch] = useState("")
	const [balances, setBalances] = useState<Record<string, {value?: number; error?: boolean; loading?: boolean}>>({})
	const [infoOf, setInfoOf] = useState<string | null>(null)
	const [operating, setOperating] = useState<{tag: Etc; kind: "deactivate" | "block"} | null>(null)
	const money = (value: number): string => `${formatAmount(value, language)} ${t("etc.rial")}`

	const loadBalance = async (serial: string): Promise<void> => {
		setBalances((current) => ({...current, [serial]: {loading: true}}))
		try {
			const value = await getEtcBalance(serial)
			setBalances((current) => ({...current, [serial]: {value}}))
		} catch {
			setBalances((current) => ({...current, [serial]: {error: true}}))
		}
	}

	const shown = (tags.data ?? []).filter((tag) => search === "" || tag.serial.includes(search))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("etc.title")}</h1>
				<div className="flex flex-wrap gap-2">
				<Button asChild size="sm">
					<Link to={routeMap.etcPurchase.path}>{t("etc.purchase.open")}</Link>
				</Button>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.etcCharge.path}>{t("etc.charge.open")}</Link>
				</Button>
				<Button type="button" variant="outline" size="sm" disabled={tags.isFetching} onClick={() => void tags.refetch()}>
					<RefreshCw aria-hidden="true" className={tags.isFetching ? "animate-spin" : undefined} />
					{t("etc.refresh")}
				</Button>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">{t("etc.hint")}</p>

			<Input className="max-w-xs" dir="ltr" inputMode="numeric" autoComplete="off" placeholder={t("etc.searchSerial")} aria-label={t("etc.searchSerial")} value={search} onChange={(event) => setSearch(normalizeDigits(event.target.value).replace(/\D/g, ""))} />

			{tags.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : tags.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{tags.error.message || t("etc.error")}
				</p>
			) : shown.length === 0 ? (
				<p className="rounded-2xl bg-card p-5 shadow-card text-sm text-muted-foreground">{t("etc.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{shown.map((tag) => {
						const balance = balances[tag.serial]
						const known = balance?.value ?? tag.balance
						return (
							<li key={tag.serial} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card">
								<div className="flex flex-wrap items-baseline justify-between gap-2">
									<h2 dir="ltr" className="text-base font-semibold tabular-nums">
										{tag.serial}
									</h2>
									<span className="text-sm text-muted-foreground">{tag.status}</span>
								</div>
								<dl className="grid gap-1 text-sm sm:grid-cols-2">
									{tag.carType ? (
										<div className="flex gap-2">
											<dt className="text-muted-foreground">{t("etc.car")}:</dt>
											<dd>{tag.carType}</dd>
										</div>
									) : null}
									{tag.plate ? (
										<div className="flex gap-2">
											<dt className="text-muted-foreground">{t("etc.plate")}:</dt>
											<dd dir="ltr">{plateText(tag.plate)}</dd>
										</div>
									) : null}
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("etc.balance")}:</dt>
										<dd>{balance?.loading ? t("etc.loading") : balance?.error ? t("etc.balanceError") : known !== null ? money(known) : "—"}</dd>
									</div>
								</dl>
								<div className="flex flex-wrap gap-2">
									{tag.operations.includes("EtcBalance") ? (
										<Button type="button" size="sm" variant="outline" disabled={balance?.loading} onClick={() => void loadBalance(tag.serial)}>
											{t("etc.showBalance")}
										</Button>
									) : null}
									{tag.operations.includes("EtcCharge") ? (
										<Button asChild size="sm">
											<Link to={`${routeMap.etcCharge.path}?serial=${encodeURIComponent(tag.serial)}`}>{t("etc.charge.action")}</Link>
										</Button>
									) : null}
									{tag.operations.includes("EtcTransferCharge") ? (
										<Button asChild size="sm" variant="outline">
											<Link to={`${routeMap.etcTransfer.path}?serial=${encodeURIComponent(tag.serial)}`}>{t("etc.transfer.action")}</Link>
										</Button>
									) : null}
									{tag.operations.includes("EtcActivation") ? (
										<Button asChild size="sm" variant="outline">
											<Link to={`${routeMap.etcActivate.path}?serial=${encodeURIComponent(tag.serial)}`}>{t("etc.activate.action")}</Link>
										</Button>
									) : null}
									{tag.operations.includes("EtcInfo") ? (
										<Button type="button" size="sm" variant="outline" onClick={() => setInfoOf(tag.serial)}>
											{t("etc.info")}
										</Button>
									) : null}
									{tag.operations.includes("EtcInactivation") ? (
										<Button type="button" size="sm" variant="outline" onClick={() => setOperating({tag, kind: "deactivate"})}>
											{t("etc.deactivate")}
										</Button>
									) : null}
									{tag.operations.includes("EtcBlock") ? (
										<Button type="button" size="sm" variant="destructive" onClick={() => setOperating({tag, kind: "block"})}>
											{t("etc.block")}
										</Button>
									) : null}
								</div>
							</li>
						)
					})}
				</ul>
			)}

			{infoOf ? <InfoDialog serial={infoOf} onClose={() => setInfoOf(null)} /> : null}
			{operating ? <EtcOperationDialog tag={operating.tag} kind={operating.kind} again={{to: routeMap.etcList.path, label: t("etc.again")}} onClose={() => setOperating(null)} /> : null}
		</div>
	)
}

function InfoDialog({serial, onClose}: {serial: string; onClose: () => void}) {
	const {t} = useTranslation()
	const info = useQuery({queryKey: ["etc", "info", serial], queryFn: () => getEtcInfo(serial), retry: false})
	const row = (label: string, value: string, ltr = false) =>
		value ? (
			<div className="flex flex-wrap justify-between gap-2 text-sm">
				<dt className="text-muted-foreground">{label}</dt>
				<dd dir={ltr ? "ltr" : undefined} className="font-medium wrap-break-word">
					{value}
				</dd>
			</div>
		) : null
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("etc.infoTitle")}</DialogTitle>
					<DialogDescription dir="ltr" className="text-start">
						{serial}
					</DialogDescription>
				</DialogHeader>
				{info.isPending ? (
					<Skeleton className="h-32 w-full" />
				) : info.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{info.error.message || t("etc.infoError")}
					</p>
				) : (
					<dl className="flex flex-col gap-2">
						{row(t("etc.owner"), info.data.owner)}
						{row(t("etc.nationalCode"), info.data.nationalCode, true)}
						{row(t("etc.mobile"), info.data.mobile, true)}
						{row(t("etc.postalCode"), info.data.postalCode, true)}
						{row(t("etc.address"), info.data.address)}
						{row(t("etc.car"), info.data.car)}
						{row(t("etc.type"), info.data.type)}
						{row(t("etc.plate"), plateText(info.data.plate), true)}
						{row(t("etc.status"), info.data.status)}
					</dl>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						{t("etc.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
