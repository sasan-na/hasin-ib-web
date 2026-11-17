import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {confirmPichakCheque, type PichakCheque} from "@/features/cheque/api/pichak-inquiry"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"

interface Props {
	sayyadId: string
	cheque: PichakCheque
	/** Accept the cheque (or its transfer to you), or turn it down. */
	accept: boolean
	onClose: () => void
}

/** Asks before telling the registry that you accept or reject a cheque. Mount it only while open. */
export function PichakConfirmDialog({sayyadId, cheque, accept, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const [note, setNote] = useState("")

	const sending = useSubmitTransaction({
		run: () => confirmPichakCheque({sayyadId, accept, description: note.trim(), series: cheque.series, serial: cheque.serial, dueDate: cheque.dueDate, amount: Number(cheque.amount)}),
		again: {to: routeMap.pichakInquiry.path, label: t("cheque.pichak.backToInquiry")},
		failedText: accept ? t("cheque.pichak.acceptFailed") : t("cheque.pichak.rejectFailed"),
		uncertainText: t("cheque.pichak.confirmUncertain"),
	})

	const amount = Number(cheque.amount)

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={accept ? t("cheque.pichak.acceptTitle") : t("cheque.pichak.rejectTitle")}
			description={accept ? t("cheque.pichak.acceptQuestion") : t("cheque.pichak.rejectQuestion")}
			summary={[
				{label: t("cheque.sayyadId"), value: <span dir="ltr">{sayyadId}</span>},
				{label: t("cheque.serial"), value: <span dir="ltr">{`${cheque.series} / ${cheque.serial}`}</span>},
				{label: t("cheque.pichak.dueDate"), value: <span dir="ltr">{cheque.dueDate}</span>},
				...(Number.isFinite(amount) ? [{label: t("cheque.pichak.amount"), value: <strong>{`${formatAmount(amount, i18n.language)} ${t("cheque.rial")}`}</strong>}] : []),
			]}
			confirmLabel={accept ? t("cheque.pichak.accept") : t("cheque.pichak.reject")}
			pendingLabel={t("cheque.pichak.sending")}
			canConfirm={!sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
			destructive={!accept}
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="pichak-note">
					{t("cheque.pichak.note")} <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span>
				</Label>
				<Input id="pichak-note" maxLength={250} value={note} disabled={sending.pending} onChange={(event) => setNote(event.target.value)} />
			</div>
		</ConfirmDialog>
	)
}
