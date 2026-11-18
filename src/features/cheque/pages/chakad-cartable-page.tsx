import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {getCartable, type CartableCheque} from "@/features/cheque/api/chakad-cartable"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

/** "14050101" as "1405/01/01"; anything else as it came. */
const dueText = (value: string): string => (/^\d{8}$/.test(value) ? `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6)}` : value)

/** Where each operation the bank offers is done here; the rest are not available in this client yet. */
const operationTarget = (key: string, sayyadId: string): string | null => {
	const guarantee = (mode: string): string => `${routeMap.chakadGuarantee.path}?mode=${mode}&sayyad=${encodeURIComponent(sayyadId)}`
	const cashing = (mode: string): string => `${routeMap.chakadCashing.path}?mode=${mode}&sayyad=${encodeURIComponent(sayyadId)}`
	switch (key) {
		case "GuaranteeInquiry":
			return guarantee("inquiry")
		case "RequestForGuarantee":
			return guarantee("request")
		case "StopGuarantorSigning":
			return guarantee("stop")
		case "ChakadTransfer":
			return cashing("transfer")
		case "ChakadOdatTransfer":
			return cashing("return")
		case "LockChequeForCashing":
			return cashing("lock")
		case "UnlockChequeForCashing":
			return cashing("unlock")
		case "ChequeClearing":
			return cashing("clear")
		case "ChakadTransfersChainInquiry":
			return routeMap.pichakChain.path
		case "ChakadOwnerChequeStatus":
			return routeMap.pichakOwner.path
		case "HolderInquiry":
		case "ChakadTransferInquiry":
		case "ConfirmCheque":
			return routeMap.pichakInquiry.path
		default:
			return null
	}
}

/** The digital cheques that concern you, with what the bank lets you do with each. */
export default function ChakadCartablePage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const cartable = useQuery({queryKey: ["cheque", "cartable"], queryFn: getCartable, staleTime: 30_000, retry: false})
	const [filter, setFilter] = useState("")
	const [open, setOpen] = useState<string | null>(null)

	const shown = (cartable.data ?? []).filter((cheque) => filter === "" || cheque.sayyadId.startsWith(filter))
	const money = (value: number): string => `${formatAmount(value, language)} ${t("cheque.rial")}`

	const row = (label: string, value: string, ltr = false) =>
		value === "" ? null : (
			<div key={label} className="flex flex-col">
				<dt className="text-muted-foreground">{label}</dt>
				<dd dir={ltr ? "ltr" : undefined} className="font-medium wrap-break-word">
					{value}
				</dd>
			</div>
		)

	const card = (cheque: CartableCheque) => {
		const expanded = open === cheque.sayyadId
		const available = cheque.operations.map((operation) => ({operation, to: operationTarget(operation.key, cheque.sayyadId)}))
		return (
			<li key={cheque.sayyadId} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<span dir="ltr" className="font-semibold">
						{cheque.sayyadId}
					</span>
					<span className="text-sm font-medium">{money(cheque.amount)}</span>
				</div>
				<p className="text-sm text-muted-foreground">
					{[cheque.status, cheque.media, dueText(cheque.dueDate)].filter(Boolean).join(" · ")}
				</p>
				<div className="flex flex-wrap gap-2">
					<Button type="button" size="sm" variant="outline" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : cheque.sayyadId)}>
						{expanded ? t("cheque.cartable.hide") : t("cheque.cartable.details")}
					</Button>
					{available.map(({operation, to}) =>
						to ? (
							<Button key={operation.key} asChild size="sm" variant="ghost">
								<Link to={to}>{operation.title}</Link>
							</Button>
						) : null,
					)}
				</div>
				{expanded ? (
					<>
						<dl className="grid gap-2 text-sm sm:grid-cols-2">
							{row(t("cheque.serial"), `${cheque.series} / ${cheque.serial}`, true)}
							{row(t("cheque.cartable.iban"), cheque.iban, true)}
							{row(t("cheque.cartable.type"), cheque.type)}
							{row(t("cheque.guarantee.guaranteeStatus"), cheque.guarantee)}
							{row(t("cheque.guarantee.blocked"), cheque.blocked)}
							{row(t("cheque.guarantee.locked"), cheque.locked)}
							{row(t("cheque.cartable.shared"), cheque.shared)}
							{row(t("cheque.pichak.description"), cheque.description)}
						</dl>
						{available.some(({to}) => to === null) ? (
							<p className="text-xs text-muted-foreground">
								{t("cheque.cartable.elsewhere", {operations: available.filter(({to}) => to === null).map(({operation}) => operation.title).join("، ")})}
							</p>
						) : null}
					</>
				) : null}
			</li>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("cheque.cartable.title")}</h1>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.chakadGuarantee.path}>{t("cheque.guarantee.title")}</Link>
					</Button>
					<Button asChild size="sm" variant="outline">
						<Link to={routeMap.chequeList.path}>{t("cheque.title")}</Link>
					</Button>
				</div>
			</div>
			<p className="text-sm text-muted-foreground">{t("cheque.cartable.hint")}</p>

			<Input dir="ltr" className="max-w-72" inputMode="numeric" maxLength={16} value={filter} placeholder={t("cheque.cartable.search")} aria-label={t("cheque.cartable.search")} onChange={(event) => setFilter(normalizeDigits(event.target.value).replace(/\D/g, ""))} />

			{cartable.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : cartable.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{cartable.error.message || t("cheque.cartable.error")}
				</p>
			) : shown.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("cheque.cartable.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">{shown.map(card)}</ul>
			)}
		</div>
	)
}
