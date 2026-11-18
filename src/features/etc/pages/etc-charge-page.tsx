import {useMutation, useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {ChoiceCards} from "@/components/flow/choice-cards"
import {AMOUNT_INPUT_CLASS, FieldError, FlowLayout, FlowSummary, StepSection} from "@/components/flow/flow-form"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
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

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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

			<FlowLayout
				aside={
					<FlowSummary
						id="etc-summary"
						title={t("etc.charge.summary")}
						amount={value > 0 ? money(value) : null}
						rows={[
							{label: t("etc.serial"), value: tag && tag.serial === serial ? tag.serial : null},
							{label: t("etc.charge.card"), value: card ? card.name || card.type : null},
						]}
						reviewLabel={t("etc.charge.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="etc-tag-step" step={1} title={t("etc.charge.tagStep")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="etc-serial">{t("etc.serial")}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="etc-serial"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={16}
								className="h-11 text-base"
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
							<Button type="button" variant="outline" size="lg" disabled={lookup.isPending || serial === ""} onClick={check}>
								{lookup.isPending ? t("etc.charge.checking") : t("etc.charge.check")}
							</Button>
						</div>
						{tag ? (
							<p role="status" className="text-sm font-medium text-success">
								{t("etc.charge.found", {owner: tag.owner || tag.serial, car: tag.car})}
							</p>
						) : null}
						{lookup.isError ? <FieldError>{lookup.error.message || t("etc.charge.lookupFailed")}</FieldError> : null}
						{errors.serial ? <FieldError>{errors.serial}</FieldError> : null}
					</div>
				</StepSection>

				<StepSection id="etc-amount-step" step={2} title={t("etc.charge.amountStep")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="etc-amount">{t("etc.charge.amount")}</Label>
						<Input id="etc-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={12} className={AMOUNT_INPUT_CLASS} value={amount} aria-invalid={errors.amount !== undefined} onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))} />
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(value)}</p> : null}
						{config.data && (config.data.min > 0 || config.data.max > 0) ? (
							<p className="text-xs text-muted-foreground">{t("etc.charge.limits", {min: money(config.data.min), max: money(config.data.max)})}</p>
						) : null}
						{errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
					</div>
				</StepSection>

				<StepSection id="etc-card-step" step={3} title={t("etc.charge.cardStep")}>
					<p id="etc-card-label" className="sr-only">
						{t("etc.charge.card")}
					</p>
					{cards.isPending ? (
						<Skeleton className="h-24 w-full" />
					) : cards.isError ? (
						<FieldError>{t("etc.charge.cardsError")}</FieldError>
					) : cards.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("etc.charge.noCards")}</p>
					) : (
						<ChoiceCards
							name="etc-card"
							labelledBy="etc-card-label"
							value={card?.id ?? null}
							onChange={(id) => setCardId(String(id))}
							choices={cards.data.map((candidate) => ({id: candidate.id, title: candidate.name || candidate.type, number: formatCardNumber(candidate.number)}))}
						/>
					)}
					{errors.card ? <FieldError>{errors.card}</FieldError> : null}
				</StepSection>
			</FlowLayout>

			{confirming && tag && card ? <EtcChargeDialog tag={tag} cardId={card.id} cardNumber={card.number} amount={value} onClose={() => setConfirming(false)} /> : null}
		</div>
	)
}
