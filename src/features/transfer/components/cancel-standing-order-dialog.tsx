import {useQueryClient} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {cancelStandingOrder, type StandingOrder} from "@/features/transfer/api/standing-order"
import {transferKeys} from "@/features/transfer/api/transfer.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"

interface Props {
	order: StandingOrder
	onClose: () => void
}

/** Asks before stopping a standing order, then sends the cancellation once. */
export function CancelStandingOrderDialog({order, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()

	const sending = useSubmitTransaction({
		run: () => cancelStandingOrder(order),
		again: {to: routeMap.transferStandingOrders.path, label: t("transfer.standing.backToList")},
		failedText: t("transfer.standing.cancelFailed"),
		uncertainText: t("transfer.standing.cancelUncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: transferKeys.standingOrders}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("transfer.standing.cancelTitle")}
			description={t("transfer.standing.cancelQuestion")}
			summary={[
				{label: t("transfer.sourceAccount"), value: <span dir="ltr">{order.sourceAccountNumber}</span>},
				{label: t("transfer.standing.destination"), value: <span dir="ltr">{order.destinationNumber}</span>},
				...(order.destinationOwner ? [{label: t("transfer.holderLabel"), value: order.destinationOwner}] : []),
				{label: t("transfer.standing.trackingId"), value: <span dir="ltr">{order.code}</span>},
				{label: t("transfer.standing.amount"), amount: true, value: `${formatAmount(order.amount, i18n.language)} ${t("transfer.rial")}`},
			]}
			confirmLabel={t("transfer.standing.cancelConfirm")}
			pendingLabel={t("transfer.standing.cancelling")}
			canConfirm={!sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
			destructive
		/>
	)
}
