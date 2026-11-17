import {useState} from "react"
import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {changeDefaultAccount, disconnectAccount, type CardAccount} from "@/features/card/api/card-account"
import {cardCredentialInfoOptions, cardKeys} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatCardNumber} from "@/lib/format"

/** The bank's service name for the SMS code on these card requests. */
const CODE_SERVICE = "CardAuthorize"

export type CardAccountAction = {kind: "default"; account: CardAccount} | {kind: "disconnect"; account: CardAccount}

interface CardAccountActionDialogProps {
	cardId: number
	cardNumber: string
	defaultAccountNumber: string
	action: CardAccountAction
	onClose: () => void
}

/**
 * Confirms making an account the card's default, or unlinking it, and asks for the card's secrets. Mount it only
 * while the action is open, so every confirmation starts from a blank form.
 */
export function CardAccountActionDialog({cardId, cardNumber, defaultAccountNumber, action, onClose}: CardAccountActionDialogProps) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery(cardCredentialInfoOptions(cardId, i18n.language))
	const credentials = toCredentials(cardNumber, form, info.data)
	const makeDefault = action.kind === "default"

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials) throw new Error("form incomplete")
			return makeDefault
				? changeDefaultAccount({oldAccountNumber: defaultAccountNumber, newAccountNumber: action.account.number, credentials})
				: disconnectAccount({account: action.account, credentials})
		},
		// A request that went through changes what the list shows.
		onDone: () => queryClient.invalidateQueries({queryKey: cardKeys.accounts(cardId)}),
		again: {to: `${routeMap.cardAccountList.path}?cardId=${cardId}`, label: t("card.accounts.backToAccounts")},
		failedText: t("card.accounts.failed"),
		uncertainText: t("card.accounts.uncertain"),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => (open ? undefined : onClose())}
			title={makeDefault ? t("card.accounts.defaultTitle") : t("card.accounts.disconnectTitle")}
			description={makeDefault ? t("card.accounts.defaultQuestion") : t("card.accounts.disconnectQuestion")}
			summary={[
				{label: t("card.number"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
				...(makeDefault ? [{label: t("card.accounts.previousDefault"), value: <span dir="ltr">{defaultAccountNumber}</span>}] : []),
				{label: makeDefault ? t("card.accounts.newDefault") : t("card.accounts.account"), value: <span dir="ltr">{action.account.number}</span>},
			]}
			confirmLabel={makeDefault ? t("card.accounts.setDefault") : t("card.accounts.disconnect")}
			pendingLabel={t("card.accounts.sending")}
			canConfirm={isCredentialsComplete(form, info.data) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} />
		</ConfirmDialog>
	)
}
