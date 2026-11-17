import {useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Checkbox} from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label"
import {blockCard} from "@/features/card/api/card-actions"
import {cardKeys} from "@/features/card/api/card.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatCardNumber} from "@/lib/format"

interface CardBlockDialogProps {
	cardNumber: string
	cardName: string
	onClose: () => void
}

/**
 * Asks twice before blocking a card (the bank treats it as final): the warning, and a tick that names the card.
 * Mount it only while it is open, so every attempt starts unticked.
 */
export function CardBlockDialog({cardNumber, cardName, onClose}: CardBlockDialogProps) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [agreed, setAgreed] = useState(false)

	const sending = useSubmitTransaction({
		run: () => blockCard(cardNumber),
		// A blocked card changes what the list shows.
		onDone: () => queryClient.invalidateQueries({queryKey: cardKeys.all}),
		again: {to: routeMap.cardList.path, label: t("card.block.backToCards")},
		failedText: t("card.block.failed"),
		uncertainText: t("card.block.uncertain"),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => (open ? undefined : onClose())}
			title={t("card.block.title")}
			description={t("card.block.warning")}
			summary={[
				{label: t("card.block.card"), value: cardName},
				{label: t("card.number"), value: <span dir="ltr">{formatCardNumber(cardNumber)}</span>},
			]}
			confirmLabel={t("card.block.confirm")}
			pendingLabel={t("card.block.sending")}
			destructive
			canConfirm={agreed && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex items-start gap-3">
				<Checkbox id="block-agree" className="mt-0.5" checked={agreed} disabled={sending.pending} onCheckedChange={(checked) => setAgreed(checked === true)} />
				<Label htmlFor="block-agree" className="leading-relaxed font-normal">
					{t("card.block.agree", {number: formatCardNumber(cardNumber)})}
				</Label>
			</div>
		</ConfirmDialog>
	)
}
