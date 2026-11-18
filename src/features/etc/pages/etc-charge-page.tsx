import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardsOptions} from "@/features/card/api/card.queries"
import {getChargeConfig, getDestEtcInfo, type EtcInfo} from "@/features/etc/api/etc"
import {EtcChargeDialog} from "@/features/etc/components/etc-charge-dialog"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Charge a toll tag (yours or someone else's) from one of your cards. */
export default function EtcChargePage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const [params] = useSearchParams()
	const config = useQuery({queryKey: ["etc", "charge-config"], queryFn: getChargeConfig, staleTime: 10 * 60_000, retry: false})
	const cards = useQuery(cardsOptions(language))
	const [serial, setSerial] = useState(() => digits(params.get("serial") ?? ""))
	const [amount, setAmount] = useState("")
	const [cardId, setCardId] = useState("")
	const [errors, setErrors] = useState<Partial<Record<"serial" | "amount" | "card", string>>>({})
	const [confirming, setConfirming] = useState(false)

	const lookup = useMutation({mutationFn: () => getDestEtcInfo(serial)})
	const tag: EtcInfo | undefined = lookup.data
	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const value = amount === "" ? 0 : Number(amount)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const money = (number: number): string => `${formatAmount(number, language)} ${t("etc.rial")}`

	const check = (): void => {
		if (serial.length < 8) return setErrors({serial: t("etc.charge.error.serial")})
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
		if (!card) found.card = t("etc.charge.error.card")
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
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("etc.charge.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.etcList.path}>
						<BackIcon aria-hidden="true" />
						{t("etc.again")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("etc.charge.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="etc-serial">{t("etc.serial")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="etc-serial"
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
					<Label htmlFor="etc-amount">{t("etc.charge.amount")}</Label>
					<Input id="etc-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={12} className="max-w-72" value={amount} aria-invalid={errors.amount !== undefined} onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))} />
					{amount !== "" ? <p className="text-sm text-muted-foreground">{money(value)}</p> : null}
					{config.data && (config.data.min > 0 || config.data.max > 0) ? (
						<p className="text-xs text-muted-foreground">{t("etc.charge.limits", {min: money(config.data.min), max: money(config.data.max)})}</p>
					) : null}
					{error(errors.amount)}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="etc-card">{t("etc.charge.card")}</Label>
					{cards.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : cards.isError ? (
						error(t("etc.charge.cardsError"))
					) : cards.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("etc.charge.noCards")}</p>
					) : (
						<Select value={cardId} onValueChange={setCardId}>
							<SelectTrigger id="etc-card" className="w-full" aria-invalid={errors.card !== undefined}>
								<SelectValue placeholder={t("etc.charge.chooseCard")} />
							</SelectTrigger>
							<SelectContent>
								{cards.data.map((candidate) => (
									<SelectItem key={candidate.id} value={String(candidate.id)}>
										<span>{candidate.name || candidate.type}</span> <span dir="ltr">{formatCardNumber(candidate.number)}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{error(errors.card)}
				</div>

				<div>
					<Button type="button" onClick={review}>
						{t("etc.charge.review")}
					</Button>
				</div>
			</section>

			{confirming && tag && card ? <EtcChargeDialog tag={tag} cardId={card.id} cardNumber={card.number} amount={value} onClose={() => setConfirming(false)} /> : null}
		</div>
	)
}
