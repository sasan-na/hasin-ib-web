import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState, type ReactNode} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {getChargeConfig, getDestEtcInfo, getEtcInfo, transferEtcCharge, type EtcInfo} from "@/features/etc/api/etc"
import {etcKeys} from "@/features/etc/api/etc.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Move charge from one of your toll tags to another tag. The tag to take it from comes in the address (?serial=). */
export default function EtcTransferPage() {
	const {t} = useTranslation()
	const [params] = useSearchParams()
	const serial = digits(params.get("serial") ?? "")
	const source = useQuery({queryKey: ["etc", "info", serial], queryFn: () => getEtcInfo(serial), enabled: serial !== "", retry: false})
	if (serial === "")
		return (
			<Shell>
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
					{t("etc.transfer.noSource")}
				</p>
			</Shell>
		)
	if (source.isPending)
		return (
			<Shell>
				<Skeleton className="h-40 w-full" />
			</Shell>
		)
	if (source.isError)
		return (
			<Shell>
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{source.error.message || t("etc.infoError")}
				</p>
			</Shell>
		)
	return (
		<Shell>
			<TransferForm source={source.data} />
		</Shell>
	)
}

function Shell({children}: {children: ReactNode}) {
	const {t, i18n} = useTranslation()
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("etc.transfer.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.etcList.path}>
						<BackIcon aria-hidden="true" />
						{t("etc.again")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("etc.transfer.hint")}</p>
			{children}
		</div>
	)
}

function TransferForm({source}: {source: EtcInfo}) {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const config = useQuery({queryKey: ["etc", "charge-config"], queryFn: getChargeConfig, staleTime: 10 * 60_000, retry: false})
	const [serial, setSerial] = useState("")
	const [amount, setAmount] = useState("")
	const [errors, setErrors] = useState<Partial<Record<"serial" | "amount", string>>>({})
	const [confirming, setConfirming] = useState(false)
	const lookup = useMutation({mutationFn: () => getDestEtcInfo(serial)})
	const tag = lookup.data
	const value = amount === "" ? 0 : Number(amount)
	const money = (number: number): string => `${formatAmount(number, language)} ${t("etc.rial")}`

	const check = (): void => {
		if (serial.length < 8) return setErrors({serial: t("etc.charge.error.serial")})
		if (serial === source.serial) return setErrors({serial: t("etc.transfer.sameTag")})
		setErrors({})
		lookup.mutate()
	}

	const review = (): void => {
		const found: typeof errors = {}
		if (!tag || tag.serial !== serial) found.serial = t("etc.charge.error.notChecked")
		const limits = config.data
		if (value <= 0) found.amount = t("etc.charge.error.amount")
		else if (limits && limits.min > 0 && value < limits.min) found.amount = t("etc.charge.error.min", {amount: money(limits.min)})
		else if (limits && limits.max > 0 && value > limits.max) found.amount = t("etc.charge.error.max", {amount: money(limits.max)})
		else if (limits && limits.step > 1 && value % limits.step !== 0) found.amount = t("etc.charge.error.step", {amount: money(limits.step)})
		setErrors(found)
		if (Object.keys(found).length === 0) setConfirming(true)
	}

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-sm text-destructive">
				{message}
			</p>
		) : null

	return (
		<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
			<div className="flex flex-wrap justify-between gap-2 text-sm">
				<span className="text-muted-foreground">{t("etc.transfer.from")}</span>
				<span dir="ltr" className="font-medium tabular-nums">
					{source.serial}
				</span>
				{source.owner ? <span className="w-full text-muted-foreground">{source.owner}</span> : null}
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="etc-to">{t("etc.transfer.to")}</Label>
				<div className="flex items-center gap-2">
					<Input
						id="etc-to"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={16}
						value={serial}
						aria-invalid={errors.serial !== undefined}
						onChange={(event) => {
							setSerial(digits(event.target.value))
							lookup.reset()
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault()
								check()
							}
						}}
					/>
					<Button type="button" variant="outline" disabled={lookup.isPending || serial === ""} onClick={check}>
						{lookup.isPending ? t("etc.charge.checking") : t("etc.charge.check")}
					</Button>
				</div>
				{tag ? (
					<p role="status" className="text-sm font-medium text-success">
						{t("etc.charge.found", {owner: tag.owner || tag.serial, car: tag.car})}
					</p>
				) : null}
				{lookup.isError ? error(lookup.error.message || t("etc.charge.lookupFailed")) : null}
				{error(errors.serial)}
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="etc-transfer-amount">{t("etc.charge.amount")}</Label>
				<Input id="etc-transfer-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={12} className="max-w-72" value={amount} aria-invalid={errors.amount !== undefined} onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))} />
				{amount !== "" ? <p className="text-sm text-muted-foreground">{money(value)}</p> : null}
				{config.data && (config.data.min > 0 || config.data.max > 0) ? <p className="text-xs text-muted-foreground">{t("etc.charge.limits", {min: money(config.data.min), max: money(config.data.max)})}</p> : null}
				{error(errors.amount)}
			</div>

			<div>
				<Button type="button" onClick={review}>
					{t("etc.charge.review")}
				</Button>
			</div>

			{confirming && tag ? <TransferDialog source={source} destination={tag} amount={value} onClose={() => setConfirming(false)} /> : null}
		</section>
	)
}

function TransferDialog({source, destination, amount, onClose}: {source: EtcInfo; destination: EtcInfo; amount: number; onClose: () => void}) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const sending = useSubmitTransaction({
		run: () => transferEtcCharge({source, destination, amount}),
		again: {to: routeMap.etcList.path, label: t("etc.again")},
		failedText: t("etc.failed"),
		uncertainText: t("etc.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: etcKeys.all}),
	})
	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("etc.transfer.confirmTitle")}
			description={t("etc.transfer.confirmQuestion")}
			summary={[
				{label: t("etc.transfer.from"), value: <span dir="ltr">{source.serial}</span>},
				{label: t("etc.transfer.to"), value: <span dir="ltr">{destination.serial}</span>},
				...(destination.owner ? [{label: t("etc.owner"), value: destination.owner}] : []),
				{label: t("etc.charge.amount"), amount: true, value: `${formatAmount(amount, i18n.language)} ${t("etc.rial")}`},
			]}
			confirmLabel={t("etc.transfer.confirm")}
			pendingLabel={t("etc.sending")}
			canConfirm={!sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		/>
	)
}
