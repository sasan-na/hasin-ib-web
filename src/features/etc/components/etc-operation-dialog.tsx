import {useQueryClient} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {blockEtc, deactivateEtc, type Etc} from "@/features/etc/api/etc"
import {etcKeys} from "@/features/etc/api/etc.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"

interface Props {
	tag: Etc
	kind: "deactivate" | "block"
	again: {to: string; label: string}
	onClose: () => void
}

/** Confirms deactivating or blocking a toll tag, then does it once. Mount it only while open. */
export function EtcOperationDialog({tag, kind, again, onClose}: Props) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const block = kind === "block"

	const sending = useSubmitTransaction({
		run: () => (block ? blockEtc(tag.serial) : deactivateEtc(tag.serial)),
		again,
		failedText: t("etc.failed"),
		uncertainText: t("etc.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: etcKeys.all}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={block ? t("etc.blockTitle") : t("etc.deactivateTitle")}
			description={block ? t("etc.blockQuestion") : t("etc.deactivateQuestion")}
			summary={[
				{label: t("etc.serial"), value: <span dir="ltr">{tag.serial}</span>},
				...(tag.carType ? [{label: t("etc.car"), value: tag.carType}] : []),
				...(tag.status ? [{label: t("etc.status"), value: tag.status}] : []),
			]}
			confirmLabel={block ? t("etc.block") : t("etc.deactivate")}
			pendingLabel={t("etc.sending")}
			destructive
			canConfirm={!sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		/>
	)
}
