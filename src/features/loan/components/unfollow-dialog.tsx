import {useMutation, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import type {Loan} from "@/features/loan/api/loan"
import {loanKeys} from "@/features/loan/api/loan.queries"
import {unfollowLoan} from "@/features/loan/api/other-loan"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {formatCardNumber} from "@/lib/format"

interface Props {
	loan: Loan
	onClose: () => void
}

/** Takes a loan of someone else off the user's list. The loan itself is not touched. Mount it only while open. */
export function UnfollowDialog({loan, onClose}: Props) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [refusal, setRefusal] = useState<string | null>(null)
	const removal = useMutation({
		mutationFn: () => unfollowLoan(loan),
		onSuccess: async () => {
			await queryClient.invalidateQueries({queryKey: loanKeys.all})
			onClose()
		},
		onError: (error: Error) => setRefusal(error.message || t("loan.other.unfollowFailed")),
	})
	const number = loan.onCard && loan.cardNumber ? formatCardNumber(loan.cardNumber) : loan.accountNumber

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("loan.other.unfollowTitle")}
			description={t("loan.other.unfollowQuestion")}
			summary={[
				{label: t("loan.pay.loan"), value: loan.title || t("loan.fallbackTitle")},
				{label: loan.onCard ? t("loan.card") : t("loan.account"), value: <span dir="ltr">{number}</span>},
				...(loan.holder ? [{label: t("loan.holder"), value: loan.holder}] : []),
			]}
			confirmLabel={t("loan.other.unfollow")}
			pendingLabel={t("loan.other.unfollowing")}
			destructive
			canConfirm
			pending={removal.isPending}
			error={refusal}
			onConfirm={() => {
				setRefusal(null)
				removal.mutate()
			}}
		/>
	)
}
