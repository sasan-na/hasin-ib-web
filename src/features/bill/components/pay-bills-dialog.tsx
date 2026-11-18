import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {cardCredentialInfoOptions, cardsOptions} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {payBills, payBillsFromCard, type PayableBill} from "@/features/bill/api/bill"
import {billKeys} from "@/features/bill/api/bill.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"

// The bank's name for paying a bill from an account: which accounts may pay, the limit and the SMS code.
const SERVICE = "AccountBillPayment"
// The bank name for the SMS code of a card transaction.
const CODE_SERVICE = "CardAuthorize"

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
	const [mode, setMode] = useState<"account" | "card">("account")
	const cards = useQuery({...cardsOptions(i18n.language), enabled: mode === "card"})
	const [cardId, setCardId] = useState("")
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const card = cards.data?.find((candidate) => String(candidate.id) === cardId)
	const info = useQuery({...cardCredentialInfoOptions(card?.id ?? 0, i18n.language), enabled: card !== undefined})
	const credentials = card ? toCredentials(card.number, form, info.data) : null

	const total = bills.reduce((sum, bill) => sum + bill.amount, 0)
	const requirement = usePasswordRequirement({accountId: source?.id ?? null, limitServiceName: SERVICE, amount: total})
	const money = (value: number): string => `${formatAmount(value, i18n.language)} ${t("bill.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (mode === "card") {
				if (!credentials) throw new Error("form incomplete")
				return payBillsFromCard({credentials, bills, remember})
			}
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
				{label: t("bill.total"), amount: true, value: money(total)},
			]}
			confirmLabel={t("bill.pay")}
			pendingLabel={t("bill.paying")}
			canConfirm={(mode === "card" ? card !== undefined && isCredentialsComplete(form, info.data) : source !== null && isPasswordComplete(requirement, password)) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex gap-2" role="group" aria-label={t("bill.payWith")}>
					<Button type="button" size="sm" variant={mode === "account" ? "default" : "outline"} aria-pressed={mode === "account"} disabled={sending.pending} onClick={() => setMode("account")}>
						{t("bill.fromAccount")}
					</Button>
					<Button type="button" size="sm" variant={mode === "card" ? "default" : "outline"} aria-pressed={mode === "card"} disabled={sending.pending} onClick={() => setMode("card")}>
						{t("bill.fromCard")}
					</Button>
				</div>
				{mode === "account" ? (
					<>
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
					</>
				) : (
					<>
						<div className="flex flex-col gap-2">
							<Label htmlFor="bill-card">{t("bill.sourceCard")}</Label>
							{cards.isPending ? (
								<Skeleton className="h-9 w-full" />
							) : cards.isError ? (
								<p role="alert" className="text-sm text-destructive">
									{t("bill.cardsError")}
								</p>
							) : cards.data.length === 0 ? (
								<p className="text-sm text-muted-foreground">{t("bill.noCards")}</p>
							) : (
								<Select
									value={cardId}
									disabled={sending.pending}
									onValueChange={(next) => {
										setCardId(next)
										// The secrets typed belong to the card that was chosen before.
										setForm(EMPTY_CREDENTIALS)
									}}
								>
									<SelectTrigger id="bill-card" className="w-full">
										<SelectValue placeholder={t("bill.chooseCard")} />
									</SelectTrigger>
									<SelectContent>
										{cards.data.map((candidate) => (
											<SelectItem key={candidate.id} value={String(candidate.id)}>
												<span>{candidate.name || candidate.type}</span> <span dir="ltr">{formatCardNumber(candidate.number)}</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
						{card ? <CardCredentialsFields cardId={card.id} cardNumber={card.number} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={sending.pending} /> : null}
					</>
				)}
			</div>
		</ConfirmDialog>
	)
}
