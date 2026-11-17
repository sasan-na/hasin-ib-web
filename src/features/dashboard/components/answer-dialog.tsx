import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
	answerWorkflow,
	type WorkflowItem,
} from "@/features/dashboard/api/dashboard"
import {
	dashboardKeys,
	transactionDetailsOptions,
} from "@/features/dashboard/api/dashboard.queries"
import { DetailList } from "@/features/dashboard/components/workflow-dialogs"
import {
	AccountPassword,
	isPasswordComplete,
	usePasswordRequirement,
} from "@/features/transaction/components/account-password"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"

// The bank's name for the check that the signed-in user may answer (it also keys the text-message code).
const SERVICE = "Authorizer_Authenticate"

interface Props {
	item: WorkflowItem
	accept: boolean
	onClose: () => void
	/** Called once the bank has taken the answer. */
	onDone: (accepted: boolean) => void
}

/** Accepts or rejects a waiting item: shows what it does, asks for the account's password and, for a rejection, a reason. Mount it only while open. */
export function AnswerDialog({ item, accept, onClose, onDone }: Props) {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const details = useQuery(transactionDetailsOptions(item.id, item.serviceKey))
	// An item that is not tied to one of the user's accounts has no password to ask for.
	const noAccount = !item.accountNumber || !item.userAccountId
	const requirement = usePasswordRequirement({
		accountId: noAccount ? null : item.userAccountId,
		limitServiceName: SERVICE,
		amount: 0,
	})
	const [password, setPassword] = useState("")
	const [reason, setReason] = useState("")
	const [refusal, setRefusal] = useState<string | null>(null)

	const answer = useMutation({
		mutationFn: () => {
			if (!noAccount && requirement.state !== "ready")
				throw new Error("form incomplete")
			const needsPassword =
				requirement.state === "ready" && requirement.needsPassword
			return answerWorkflow({
				workflowRunId: item.id,
				accept,
				isSign: item.isSign,
				rejectReason: reason.trim(),
				password: needsPassword ? password : null,
				passwordType: requirement.state === "ready" ? requirement.info.type : 2,
			})
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
			onDone(accept)
		},
		onError: (error: Error) =>
			setRefusal(error.message || t("dashboard.answer.failed")),
	})

	const needsReason = !accept

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={
				accept
					? t("dashboard.answer.acceptTitle")
					: t("dashboard.answer.rejectTitle")
			}
			description={
				accept
					? t("dashboard.answer.acceptQuestion")
					: t("dashboard.answer.rejectQuestion")
			}
			summary={[
				{ label: t("dashboard.item.name"), value: item.name },
				{ label: t("dashboard.item.service"), value: item.serviceName },
				...(item.accountNumber
					? [
							{
								label: t("dashboard.item.account"),
								value: <span dir="ltr">{item.accountNumber}</span>,
							},
						]
					: []),
				...(item.initiator
					? [{ label: t("dashboard.item.initiator"), value: item.initiator }]
					: []),
			]}
			confirmLabel={
				accept ? t("dashboard.answer.accept") : t("dashboard.answer.reject")
			}
			pendingLabel={t("dashboard.answer.sending")}
			destructive={!accept}
			canConfirm={
				(noAccount || isPasswordComplete(requirement, password)) &&
				(!needsReason || reason.trim() !== "")
			}
			pending={answer.isPending}
			error={refusal}
			onConfirm={() => {
				setRefusal(null)
				answer.mutate()
			}}
		>
			<div className="flex max-h-[40vh] flex-col gap-4 overflow-y-auto">
				{details.isPending ? (
					<Skeleton className="h-20 w-full" />
				) : details.isError ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.details.error")}
					</p>
				) : (
					<DetailList details={details.data} />
				)}
				{needsReason ? (
					<div className="flex flex-col gap-2">
						<Label htmlFor="answer-reason">
							{t("dashboard.answer.reason")}
						</Label>
						<Textarea
							id="answer-reason"
							maxLength={500}
							value={reason}
							disabled={answer.isPending}
							onChange={(event) => setReason(event.target.value)}
						/>
					</div>
				) : null}
				{!noAccount ? (
					<AccountPassword
						requirement={requirement}
						accountNumber={item.accountNumber}
						codeServiceName={SERVICE}
						amount={0}
						value={password}
						onChange={setPassword}
						disabled={answer.isPending}
					/>
				) : null}
			</div>
		</ConfirmDialog>
	)
}
