import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {cardCredentialInfoOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {chargeEtc, type EtcInfo} from "@/features/etc/api/etc"
import {etcKeys} from "@/features/etc/api/etc.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"

// The bank's name for the SMS code of a card transaction.
const CODE_SERVICE = "CardAuthorize"

interface Props {
	tag: EtcInfo
	cardId: number
	cardNumber: string
	/** In Rials. */
	amount: number
	onClose: () => void
}

/** Confirms charging a toll tag and asks for the paying card's secrets. Mount it only while open. */
export function EtcChargeDialog({tag, cardId, cardNumber, amount, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const info = useQuery(cardCredentialInfoOptions(cardId, i18n.language))
	const credentials = toCredentials(cardNumber, form, info.data)

	const sending = useSubmitTransaction({
		run: () => {
			if (!credentials) throw new Error("form incomplete")
			return chargeEtc({credentials, tag, amount})
		},
		again: {to: routeMap.etcList.path, label: t("etc.again")},
		failedText: t("etc.failed"),
		uncertainText: t("etc.charge.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: etcKeys.all}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("etc.charge.confirmTitle")}
			description={t("etc.charge.confirmQuestion")}
			summary={[
				{label: t("etc.serial"), value: <span dir="ltr">{tag.serial}</span>},
				...(tag.owner ? [{label: t("etc.owner"), value: tag.owner}] : []),
				...(tag.car ? [{label: t("etc.car"), value: tag.car}] : []),
				{label: t("etc.charge.card"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
				{label: t("etc.charge.amount"), amount: true, value: `${formatAmount(amount, i18n.language)} ${t("etc.rial")}`},
			]}
			confirmLabel={t("etc.charge.confirm")}
			pendingLabel={t("etc.sending")}
			canConfirm={isCredentialsComplete(form, info.data) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} />
		</ConfirmDialog>
	)
}
