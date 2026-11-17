import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {cancelCardless, issueCardless, type CardlessTicket} from "@/features/card/api/cardless"
import {cardCredentialInfoOptions, cardKeys} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"

// The bank's name for the SMS code of a card transaction.
const CODE_SERVICE = "CardAuthorize"

interface IssueProps {
	cardId: number
	cardNumber: string
	mobile: string
	amount: number
	password: string
	remember: boolean
	onClose: () => void
}

/** Confirms a new card-less withdrawal and asks for the card's secrets. Mount it only while open. */
export function IssueCardlessDialog({cardId, cardNumber, mobile, amount, password, remember, onClose}: IssueProps) {
	const {t, i18n} = useTranslation()
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery(cardCredentialInfoOptions(cardId, i18n.language))
	const credentials = toCredentials(cardNumber, form, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials) throw new Error("form incomplete")
			return issueCardless({credentials, mobile, amount, password, remember})
		},
		again: {to: routeMap.cardlessNew.path, label: t("card.cardless.again")},
		failedText: t("card.cardless.failed"),
		uncertainText: t("card.cardless.uncertain"),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("card.cardless.confirmTitle")}
			description={t("card.cardless.confirmQuestion")}
			summary={[
				{label: t("card.cardless.card"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
				{label: t("card.cardless.mobile"), value: <span dir="ltr">{mobile}</span>},
				{label: t("card.cardless.amount"), value: <strong>{`${formatAmount(amount, i18n.language)} ${t("card.rial")}`}</strong>},
			]}
			confirmLabel={t("card.cardless.issue")}
			pendingLabel={t("card.cardless.issuing")}
			canConfirm={isCredentialsComplete(form, info.data) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} />
		</ConfirmDialog>
	)
}

interface CancelProps {
	ticket: CardlessTicket
	onClose: () => void
}

/** Confirms cancelling an unused ticket and asks for the card's secrets. Mount it only while open. */
export function CancelCardlessDialog({ticket, onClose}: CancelProps) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery(cardCredentialInfoOptions(ticket.cardId, i18n.language))
	const credentials = toCredentials(ticket.cardNumber, form, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials) throw new Error("form incomplete")
			return cancelCardless({credentials, ticket})
		},
		again: {to: routeMap.cardlessList.path, label: t("card.cardless.backToList")},
		failedText: t("card.cardless.cancelFailed"),
		uncertainText: t("card.cardless.cancelUncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: cardKeys.cardless}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("card.cardless.cancelTitle")}
			description={t("card.cardless.cancelQuestion")}
			summary={[
				{label: t("card.cardless.traceNumber"), value: <span dir="ltr">{ticket.traceNumber}</span>},
				{label: t("card.cardless.card"), value: <span dir="ltr">{formatCardNumber(ticket.cardNumber)}</span>},
				{label: t("card.cardless.mobile"), value: <span dir="ltr">{ticket.mobile}</span>},
				{label: t("card.cardless.amount"), value: <strong>{`${formatAmount(ticket.amount, i18n.language)} ${t("card.rial")}`}</strong>},
			]}
			confirmLabel={t("card.cardless.cancelConfirm")}
			pendingLabel={t("card.cardless.cancelling")}
			canConfirm={isCredentialsComplete(form, info.data) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
			destructive
		>
			<CardCredentialsFields cardId={ticket.cardId} cardNumber={ticket.cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} />
		</ConfirmDialog>
	)
}
