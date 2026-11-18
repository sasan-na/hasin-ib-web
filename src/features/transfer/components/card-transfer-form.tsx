import {useMutation, useQuery} from "@tanstack/react-query"
import {Loader2, Search} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardsOptions} from "@/features/card/api/card.queries"
import {getCardHolder} from "@/features/transfer/api/card-transfer"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {CardTransferDialog} from "@/features/transfer/components/card-transfer-dialog"
import {ChoiceCards} from "@/components/flow/choice-cards"
import {FieldError, HolderCard, AMOUNT_INPUT_CLASS, QuickAmounts, StepSection, FlowLayout, FlowSummary} from "@/components/flow/flow-form"
import {PayeeShortcuts} from "@/features/transfer/components/payee-shortcuts"
import {isValidCardNumber} from "@/features/transfer/lib/numbers"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Errors = Partial<Record<"source" | "destination" | "amount" | "reason", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Send money from one of your cards to any bank card by its number. */
export function CardTransferForm() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const cards = useQuery(cardsOptions(language))
	const reasons = useQuery(reasonCodesOptions(language))

	const [sourceId, setSourceId] = useState("")
	const [destination, setDestination] = useState("")
	const [amount, setAmount] = useState("")
	const [reasonCode, setReasonCode] = useState("")
	const [description, setDescription] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)

	const source = cards.data?.find((card) => String(card.id) === sourceId)
	const lookup = useMutation({mutationFn: () => getCardHolder(source?.number ?? "", destination)})
	const holder = lookup.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const money = (value: number): string => `${formatAmount(value, language)} ${t("transfer.rial")}`

	const touch = (): void => setErrors({})

	const destinationProblem = (): string | null => {
		if (!isValidCardNumber(destination)) return t("transfer.card.error.format")
		if (source && source.number === destination) return t("transfer.card.error.same")
		return null
	}

	const check = (): void => {
		const found: Errors = {}
		if (!source) found.source = t("transfer.card.error.source")
		const problem = destinationProblem()
		if (problem) found.destination = problem
		setErrors(found)
		if (Object.keys(found).length === 0) lookup.mutate()
	}

	const review = (): void => {
		const found: Errors = {}
		if (!source) found.source = t("transfer.card.error.source")
		if (!holder) found.destination = destinationProblem() ?? t("transfer.card.error.notChecked")
		if (amountValue <= 0) found.amount = t("transfer.error.amount")
		if ((reasons.data?.length ?? 0) > 0 && !reason) found.reason = t("transfer.error.reason")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setConfirming(true)
	}

	return (
		<>
			<FlowLayout
				aside={
					<FlowSummary
						id="ct-summary"
						title={t("transfer.summary")}
						amount={amountValue > 0 ? money(amountValue) : null}
						rows={[
							{label: t("transfer.card.sourceCard"), value: source ? source.name || source.type : null},
							{label: t("transfer.card.holderLabel"), value: holder ? holder.name : null},
							{label: t("transfer.reason"), value: reason?.name ?? null},
						]}
						reviewLabel={t("transfer.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="ct-from" step={1} title={t("transfer.from")}>
					<p id="ct-source-label" className="sr-only">
						{t("transfer.card.sourceCard")}
					</p>
					{cards.isPending ? (
						<Skeleton className="h-24 w-full" />
					) : cards.isError ? (
						<FieldError>{t("transfer.card.cardsError")}</FieldError>
					) : cards.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("transfer.card.noCards")}</p>
					) : (
						<ChoiceCards
							name="ct-source"
							labelledBy="ct-source-label"
							value={source?.id ?? null}
							onChange={(id) => {
								setSourceId(String(id))
								// The lookup was made for another paying card.
								lookup.reset()
								touch()
							}}
							choices={cards.data.map((card) => ({id: card.id, title: card.name || card.type, number: formatCardNumber(card.number)}))}
						/>
					)}
					{errors.source ? <FieldError>{errors.source}</FieldError> : null}
				</StepSection>

				<StepSection id="ct-to" step={2} title={t("transfer.to")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="ct-destination">{t("transfer.card.destinationCard")}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="ct-destination"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={16}
								className="h-11 text-base"
								value={destination}
								aria-invalid={errors.destination !== undefined}
								aria-describedby={errors.destination !== undefined ? "ct-destination-error" : undefined}
								onChange={(event) => {
									setDestination(digits(event.target.value))
									lookup.reset()
									touch()
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault()
										check()
									}
								}}
							/>
							<Button type="button" variant="outline" className="h-11" disabled={lookup.isPending || destination === ""} onClick={check}>
								{lookup.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
								{lookup.isPending ? t("transfer.checking") : t("transfer.check")}
							</Button>
						</div>
						<PayeeShortcuts
							kind="cards"
							onPick={(number) => {
								setDestination(number)
								lookup.reset()
								touch()
							}}
						/>
						{holder ? <HolderCard label={t("transfer.card.holderLabel")} name={holder.name} /> : null}
						{lookup.isError ? <FieldError>{lookup.error.message || t("transfer.lookupFailed")}</FieldError> : null}
						{errors.destination ? <FieldError id="ct-destination-error">{errors.destination}</FieldError> : null}
					</div>
				</StepSection>

				<StepSection id="ct-details" step={3} title={t("transfer.details")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="ct-amount">{t("transfer.amount")}</Label>
						<Input
							id="ct-amount"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={15}
							className={AMOUNT_INPUT_CLASS}
							value={amount}
							aria-invalid={errors.amount !== undefined}
							aria-describedby={errors.amount !== undefined ? "ct-amount-error" : undefined}
							onChange={(event) => {
								setAmount(digits(event.target.value).replace(/^0+/, ""))
								touch()
							}}
						/>
						<QuickAmounts
							value={amountValue}
							onPick={(quick) => {
								setAmount(String(quick))
								touch()
							}}
						/>
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
						{errors.amount ? <FieldError id="ct-amount-error">{errors.amount}</FieldError> : null}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="ct-reason">{t("transfer.reason")}</Label>
							{reasons.isPending ? (
								<Skeleton className="h-9 w-full" />
							) : reasons.isError ? (
								<FieldError>{t("transfer.reasonsError")}</FieldError>
							) : (
								<Select
									value={reasonCode}
									onValueChange={(value) => {
										setReasonCode(value)
										touch()
									}}
								>
									<SelectTrigger id="ct-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
										<SelectValue placeholder={t("transfer.chooseReason")} />
									</SelectTrigger>
									<SelectContent>
										{reasons.data.map((candidate) => (
											<SelectItem key={candidate.code} value={candidate.code}>
												{candidate.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
							{errors.reason ? <FieldError>{errors.reason}</FieldError> : null}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="ct-description">
								{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
							</Label>
							<Input id="ct-description" value={description} onChange={(event) => setDescription(event.target.value)} />
						</div>
					</div>
				</StepSection>
			</FlowLayout>

			{confirming && source && holder ? (
				<CardTransferDialog
					cardId={source.id}
					cardNumber={source.number}
					holder={holder}
					amount={amountValue}
					description={description.trim()}
					reason={reason}
					onClose={() => {
						setConfirming(false)
						// The lookup is single-use: whatever happened, the next attempt starts with a fresh one.
						lookup.reset()
					}}
				/>
			) : null}
		</>
	)
}
