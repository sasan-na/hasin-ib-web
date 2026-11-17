import {useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Label} from "@/components/ui/label"
import {payBills, type PayableBill} from "@/features/bill/api/bill"
import {billKeys} from "@/features/bill/api/bill.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"

// The bank's name for paying a bill from an account: which accounts may pay, the limit and the SMS code.
const SERVICE = "AccountBillPayment"

interface Props {
	bills: PayableBill[]
	/** Keep the bills in the saved list after paying. */
	remember: boolean
	onClose: () => void
}

/** Asks which account pays, shows what will be paid, and sends the payment once. */
export function PayBillsDialog({bills, remember, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [password, setPassword] = useState("")

	const total = bills.reduce((sum, bill) => sum + bill.amount, 0)
	const requirement = usePasswordRequirement({accountId: source?.id ?? null, limitServiceName: SERVICE, amount: total})
	const money = (value: number): string => `${formatAmount(value, i18n.language)} ${t("bill.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || requirement.state !== "ready") throw new Error("form incomplete")
			return payBills({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				bills,
				remember,
			})
		},
		again: {to: routeMap.billList.path, label: t("bill.again")},
		failedText: t("bill.failed"),
		uncertainText: t("bill.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: billKeys.all}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("bill.confirmTitle")}
			description={t("bill.confirmQuestion", {count: bills.length})}
			summary={[
				...bills.map((bill) => ({
					label: bill.title || bill.mobile || bill.billId,
					value: (
						<span>
							<span dir="ltr">{bill.billId}</span> · {money(bill.amount)}
						</span>
					),
				})),
				{label: t("bill.total"), value: <strong>{money(total)}</strong>},
			]}
			confirmLabel={t("bill.pay")}
			pendingLabel={t("bill.paying")}
			canConfirm={source !== null && isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="bill-source">{t("bill.sourceAccount")}</Label>
					<SourceAccountSelect
						id="bill-source"
						serviceName={SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							setPassword("")
						}}
						invalid={false}
					/>
				</div>
				{source ? (
					<AccountPassword requirement={requirement} accountNumber={source.number} codeServiceName={SERVICE} amount={total} value={password} onChange={setPassword} disabled={sending.pending} />
				) : null}
			</div>
		</ConfirmDialog>
	)
}
