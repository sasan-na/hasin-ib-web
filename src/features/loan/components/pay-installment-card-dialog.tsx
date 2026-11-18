import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardCredentialInfoOptions, cardsOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {payInstallmentFromCard, type Loan} from "@/features/loan/api/loan"
import {loanKeys} from "@/features/loan/api/loan.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the SMS code of a card transaction.
const CODE_SERVICE = "CardAuthorize"

interface Props {
	loan: Loan
	/** Offer to add the loan to the user's list (for a loan of someone else that is not in it yet). */
	offerFollow?: boolean
	onClose: () => void
}

/** Pays towards a loan from one of the user's cards: which card, how much and the card's secrets. Mount it only while open. */
export function PayInstallmentCardDialog({loan, offerFollow = false, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const cards = useQuery(cardsOptions(i18n.language))
	const [cardId, setCardId] = useState("")
	const [amount, setAmount] = useState(loan.installment !== null && loan.installment > 0 ? String(loan.installment) : "")
	const [follow, setFollow] = useState(false)
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)

	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({...cardCredentialInfoOptions(card?.id ?? 0, i18n.language), enabled: card !== undefined})
	const credentials = card ? toCredentials(card.number, form, info.data) : null
	const value = amount === "" ? 0 : Number(amount)
	const money = (number: number): string => `${formatAmount(number, i18n.language)} ${t("loan.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials || value <= 0) throw new Error("form incomplete")
			return payInstallmentFromCard({credentials, loan, amount: value, follow: offerFollow && follow})
		},
		again: {to: routeMap.loanList.path, label: t("loan.pay.again")},
		failedText: t("loan.pay.failed"),
		uncertainText: t("loan.pay.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: loanKeys.all}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("loan.pay.cardTitle")}
			description={t("loan.pay.cardQuestion")}
			summary={[
				{label: t("loan.pay.loan"), value: loan.title || t("loan.fallbackTitle")},
				...(loan.onCard && loan.cardNumber ? [{label: t("loan.card"), value: <span dir="ltr">{formatCardNumber(loan.cardNumber)}</span>}] : [{label: t("loan.account"), value: <span dir="ltr">{loan.accountNumber}</span>}]),
				...(loan.holder ? [{label: t("loan.pay.owner"), value: loan.holder}] : []),
				...(card ? [{label: t("loan.pay.fromCard"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>}] : []),
				...(value > 0 ? [{label: t("loan.pay.amount"), amount: true, value: money(value)}] : []),
			]}
			confirmLabel={t("loan.pay.confirm")}
			pendingLabel={t("loan.pay.sending")}
			canConfirm={card !== undefined && value > 0 && isCredentialsComplete(form, info.data) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="pay-card">{t("loan.pay.fromCard")}</Label>
					{cards.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : cards.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("loan.pay.cardsError")}
						</p>
					) : cards.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t("loan.pay.noCards")}</p>
					) : (
						<Select
							value={cardId}
							disabled={sending.pending}
							onValueChange={(next) => {
								setCardId(next)
								// The secrets typed belong to the card that was chosen before.
								setForm(EMPTY_CREDENTIALS)
							}}
						>
							<SelectTrigger id="pay-card" className="w-full">
								<SelectValue placeholder={t("loan.pay.chooseCard")} />
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
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="pay-card-amount">{t("loan.pay.amount")}</Label>
					<Input
						id="pay-card-amount"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={15}
						value={amount}
						disabled={sending.pending}
						onChange={(event) => setAmount(normalizeDigits(event.target.value).replace(/\D/g, "").replace(/^0+/, ""))}
					/>
					{loan.installment !== null && loan.installment > 0 ? <p className="text-xs text-muted-foreground">{t("loan.pay.installmentIs", {amount: money(loan.installment)})}</p> : null}
				</div>
				{offerFollow ? (
					<div className="flex items-center gap-2">
						<Checkbox id="pay-card-follow" checked={follow} disabled={sending.pending} onCheckedChange={(checked) => setFollow(checked === true)} />
						<Label htmlFor="pay-card-follow">{t("loan.pay.follow")}</Label>
					</div>
				) : null}
				{card ? <CardCredentialsFields cardId={card.id} cardNumber={card.number} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} /> : null}
			</div>
		</ConfirmDialog>
	)
}
