import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { routeMap } from "@/app/routes"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { payInstallment, type Loan } from "@/features/loan/api/loan"
import { loanKeys } from "@/features/loan/api/loan.queries"
import type { SourceAccount } from "@/features/transaction/api/transaction"
import {
	AccountPassword,
	isPasswordComplete,
	usePasswordRequirement,
} from "@/features/transaction/components/account-password"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { SourceAccountSelect } from "@/features/transaction/components/source-account-select"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import { reasonCodesOptions } from "@/features/transfer/api/transfer.queries"
import { formatAmount, formatCardNumber } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"

// The bank's name for paying an installment from an account: which accounts may pay, the limit and the SMS code.
const SERVICE = "AccountInstallment"

interface Props {
	loan: Loan
	/** Offer to add the loan to the user's list (for a loan of someone else that is not in it yet). */
	offerFollow?: boolean
	onClose: () => void
}

/** Pays towards a loan from one of the user's accounts: which account, how much (the installment is offered) and why. Mount it only while open. */
export function PayInstallmentDialog({ loan, offerFollow = false, onClose }: Props) {
	const { t, i18n } = useTranslation()
	const queryClient = useQueryClient()
	const reasons = useQuery(reasonCodesOptions(i18n.language))
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [amount, setAmount] = useState(
		loan.installment !== null && loan.installment > 0
			? String(loan.installment)
			: "",
	)
	const [reasonCode, setReasonCode] = useState("")
	const [password, setPassword] = useState("")
	const [follow, setFollow] = useState(false)

	const value = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find(
		(candidate) => candidate.code === reasonCode,
	)
	const requirement = usePasswordRequirement({
		accountId: source?.id ?? null,
		limitServiceName: SERVICE,
		amount: value,
	})
	const money = (number: number): string =>
		`${formatAmount(number, i18n.language)} ${t("loan.rial")}`
	const needsReason = (reasons.data?.length ?? 0) > 0

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || requirement.state !== "ready" || value <= 0)
				throw new Error("form incomplete")
			return payInstallment({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				loan,
				amount: value,
				reasonCode,
				follow: offerFollow && follow,
			})
		},
		again: { to: routeMap.loanList.path, label: t("loan.pay.again") },
		failedText: t("loan.pay.failed"),
		uncertainText: t("loan.pay.uncertain"),
		onDone: () => queryClient.invalidateQueries({ queryKey: loanKeys.all }),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("loan.pay.title")}
			description={t("loan.pay.question")}
			summary={[
				{
					label: t("loan.pay.loan"),
					value: loan.title || t("loan.fallbackTitle"),
				},
				...(loan.onCard && loan.cardNumber
					? [
							{
								label: t("loan.card"),
								value: (
									<span dir="ltr">{formatCardNumber(loan.cardNumber)}</span>
								),
							},
						]
					: [
							{
								label: t("loan.account"),
								value: <span dir="ltr">{loan.accountNumber}</span>,
							},
						]),
				...(loan.holder
					? [{ label: t("loan.pay.owner"), value: loan.holder }]
					: []),
				...(source
					? [
							{
								label: t("loan.pay.from"),
								value: <span dir="ltr">{source.number}</span>,
							},
						]
					: []),
				...(value > 0
					? [
							{
								label: t("loan.pay.amount"),
								value: <strong>{money(value)}</strong>,
							},
						]
					: []),
				...(reason
					? [{ label: t("loan.pay.reason"), value: reason.name }]
					: []),
			]}
			confirmLabel={t("loan.pay.confirm")}
			pendingLabel={t("loan.pay.sending")}
			canConfirm={
				source !== null &&
				value > 0 &&
				(!needsReason || reason !== undefined) &&
				isPasswordComplete(requirement, password) &&
				!sending.blocked
			}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="pay-source">{t("loan.pay.from")}</Label>
					<SourceAccountSelect
						id="pay-source"
						serviceName={SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							setPassword("")
						}}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="pay-amount">{t("loan.pay.amount")}</Label>
					<Input
						id="pay-amount"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={15}
						value={amount}
						disabled={sending.pending}
						onChange={(event) =>
							setAmount(
								normalizeDigits(event.target.value)
									.replace(/\D/g, "")
									.replace(/^0+/, ""),
							)
						}
					/>
					{loan.installment !== null && loan.installment > 0 ? (
						<p className="text-muted-foreground text-xs">
							{t("loan.pay.installmentIs", { amount: money(loan.installment) })}
						</p>
					) : null}
				</div>
				{offerFollow ? (
					<div className="flex items-center gap-2">
						<Checkbox id="pay-follow" checked={follow} disabled={sending.pending} onCheckedChange={(checked) => setFollow(checked === true)} />
						<Label htmlFor="pay-follow">{t("loan.pay.follow")}</Label>
					</div>
				) : null}
				<div className="flex flex-col gap-2">
					<Label htmlFor="pay-reason">{t("loan.pay.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : (
						<Select
							value={reasonCode}
							onValueChange={setReasonCode}
							disabled={sending.pending}
						>
							<SelectTrigger id="pay-reason" className="w-full">
								<SelectValue placeholder={t("loan.pay.chooseReason")} />
							</SelectTrigger>
							<SelectContent>
								{(reasons.data ?? []).map((candidate) => (
									<SelectItem key={candidate.code} value={candidate.code}>
										{candidate.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				{source ? (
					<AccountPassword
						requirement={requirement}
						accountNumber={source.number}
						codeServiceName={SERVICE}
						amount={value}
						value={password}
						onChange={setPassword}
						disabled={sending.pending}
					/>
				) : null}
			</div>
		</ConfirmDialog>
	)
}
