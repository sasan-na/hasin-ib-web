import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {cardCredentialInfoOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {transferCard, type CardHolder} from "@/features/transfer/api/card-transfer"
import {formatAmount, formatCardNumber} from "@/lib/format"

// The bank's name for the SMS code of a card transaction.
const CODE_SERVICE = "CardAuthorize"

interface Props {
	cardId: number
	cardNumber: string
	holder: CardHolder
	amount: number
	description: string
	reason: {code: string; name: string} | undefined
	onClose: () => void
}

/**
 * Confirms a card-to-card transfer and asks for the paying card's secrets. Mount it only while it is open, so every
 * confirmation starts from a blank form. The lookup it relies on is single-use: after a refusal the user closes this
 * and checks the destination again.
 */
export function CardTransferDialog({cardId, cardNumber, holder, amount, description, reason, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery(cardCredentialInfoOptions(cardId, i18n.language))
	const credentials = toCredentials(cardNumber, form, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials) throw new Error("form incomplete")
			return transferCard({credentials, holder, amount, description, reasonCode: reason?.code ?? ""})
		},
		again: {to: `${routeMap.transferSmart.path}?type=card`, label: t("transfer.again")},
		failedText: t("transfer.failed"),
		uncertainText: t("transfer.uncertain"),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("transfer.confirmTitle")}
			description={t("transfer.card.confirmQuestion")}
			summary={[
				{label: t("transfer.card.sourceCard"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
				{label: t("transfer.card.destinationCard"), value: <span dir="ltr">{formatCardNumber(holder.destinationNumber)}</span>},
				{label: t("transfer.holderLabel"), value: holder.name},
				{label: t("transfer.amount"), amount: true, value: `${formatAmount(amount, i18n.language)} ${t("transfer.rial")}`},
				...(reason ? [{label: t("transfer.reason"), value: reason.name}] : []),
				...(description !== "" ? [{label: t("transfer.description"), value: description}] : []),
			]}
			confirmLabel={t("transfer.confirm")}
			pendingLabel={t("transfer.sending")}
			canConfirm={isCredentialsComplete(form, info.data) && !sending.blocked && sending.refusal === null}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} />
			{sending.refusal !== null ? <p className="text-sm text-muted-foreground">{t("transfer.card.checkAgain")}</p> : null}
		</ConfirmDialog>
	)
}
