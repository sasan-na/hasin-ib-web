import {useMutation, useQuery} from "@tanstack/react-query"
import {Loader2, Search} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {useLocation} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {SourceAccountCards} from "@/features/transfer/components/source-account-cards"
import {FieldError, HolderCard, QUICK_AMOUNTS, QuickAmounts, StepSection, TransferFormLayout, TransferSummary} from "@/features/transfer/components/transfer-form"
import {getAccountOwner, transferInternal} from "@/features/transfer/api/transfer"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {sourceAccountsOptions} from "@/features/transaction/api/transaction.queries"
import {readPrefill} from "@/features/transfer/lib/prefill"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's names for an account-to-account transfer: which accounts may pay, the limit and the SMS code.
const SOURCE_SERVICE = "AccountTransferMoney"
const LIMIT_SERVICE = "TransferMoney"
const CODE_SERVICE = "TransferMoney"
const ACCOUNT_PATTERN = /^\d{5,15}$/

type Errors = Partial<Record<"source" | "destination" | "amount" | "reason", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Send money from one of your accounts to another Maskan account. */
export default function SmartTransferPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const reasons = useQuery(reasonCodesOptions(language))

	// The home page's quick transfer hands over what was typed there.
	const location = useLocation()
	const [prefill] = useState(() => readPrefill(location.state))
	const accounts = useQuery(sourceAccountsOptions(SOURCE_SERVICE, language))
	const [chosen, setSource] = useState<SourceAccount | null>(null)
	const source = chosen ?? (prefill?.sourceId != null ? (accounts.data?.find((account) => account.id === prefill.sourceId) ?? null) : null)
	const [destination, setDestination] = useState(prefill?.destination ?? "")
	const [amount, setAmount] = useState(prefill?.amount ?? "")
	const [reasonCode, setReasonCode] = useState("")
	const [description, setDescription] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	// Who holds the destination account. Looked up on request; typing another number forgets the answer.
	const lookup = useMutation({mutationFn: getAccountOwner})
	const owner = lookup.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: LIMIT_SERVICE, amount: amountValue})

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || !owner || requirement.state !== "ready") throw new Error("form incomplete")
			return transferInternal({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				destination: owner,
				amount: amountValue,
				description: description.trim(),
				reasonCode,
			})
		},
		again: {to: routeMap.transferSmart.path, label: t("transfer.again")},
		failedText: t("transfer.failed"),
		uncertainText: t("transfer.uncertain"),
	})

	const touch = (): void => setErrors({})

	const check = (): void => {
		if (!ACCOUNT_PATTERN.test(destination)) {
			setErrors({destination: t("transfer.error.destinationFormat")})
			return
		}
		touch()
		lookup.mutate(destination)
	}

	const review = (): void => {
		const found: Errors = {}
		if (!source) found.source = t("transfer.error.source")
		if (!owner) found.destination = ACCOUNT_PATTERN.test(destination) ? t("transfer.error.notChecked") : t("transfer.error.destinationFormat")
		else if (source && source.number === owner.number) found.destination = t("transfer.error.sameAccount")
		if (amountValue <= 0) found.amount = t("transfer.error.amount")
		if ((reasons.data?.length ?? 0) > 0 && !reason) found.reason = t("transfer.error.reason")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	const money = (value: number): string => `${formatAmount(value, language)} ${t("transfer.rial")}`

	return (
		<>
			<TransferFormLayout
				title={t("transfer.smart.title")}
				aside={
					<TransferSummary
						id="transfer-summary"
						title={t("transfer.summary")}
						amount={amountValue > 0 ? money(amountValue) : null}
						rows={[
							{label: t("transfer.sourceAccount"), value: source ? source.name || source.type : null},
							{label: t("transfer.holderLabel"), value: owner ? owner.name || owner.number : null},
							{label: t("transfer.reason"), value: reason?.name ?? null},
						]}
						reviewLabel={t("transfer.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="transfer-from" step={1} title={t("transfer.from")}>
					<p id="transfer-source-label" className="sr-only">
						{t("transfer.sourceAccount")}
					</p>
					<SourceAccountCards
						serviceName={SOURCE_SERVICE}
						value={source?.id ?? null}
						labelledBy="transfer-source-label"
						onChange={(account) => {
							setSource(account)
							touch()
						}}
					/>
					{errors.source ? <FieldError>{errors.source}</FieldError> : null}
				</StepSection>

				<StepSection id="transfer-to" step={2} title={t("transfer.to")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="transfer-destination">{t("transfer.destinationAccount")}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="transfer-destination"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={15}
								className="h-11 text-base"
								value={destination}
								aria-invalid={errors.destination !== undefined}
								aria-describedby={errors.destination !== undefined ? "transfer-destination-error" : undefined}
								onChange={(event) => {
									setDestination(digits(event.target.value))
									lookup.reset()
									touch()
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault()
										check()
									}
								}}
							/>
							<Button type="button" variant="outline" className="h-11" disabled={lookup.isPending || destination === ""} onClick={check}>
								{lookup.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
								{lookup.isPending ? t("transfer.checking") : t("transfer.check")}
							</Button>
						</div>
						{owner ? <HolderCard label={t("transfer.holderLabel")} name={owner.name || owner.number} /> : null}
						{lookup.isError ? <FieldError>{lookup.error.message || t("transfer.lookupFailed")}</FieldError> : null}
						{errors.destination ? <FieldError id="transfer-destination-error">{errors.destination}</FieldError> : null}
					</div>
				</StepSection>

				<StepSection id="transfer-details" step={3} title={t("transfer.details")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="transfer-amount">{t("transfer.amount")}</Label>
						<Input
							id="transfer-amount"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={15}
							className="h-14 text-xl font-semibold md:text-xl"
							value={amount}
							aria-invalid={errors.amount !== undefined}
							aria-describedby={errors.amount !== undefined ? "transfer-amount-error" : undefined}
							onChange={(event) => {
								setAmount(digits(event.target.value).replace(/^0+/, ""))
								touch()
							}}
						/>
						<QuickAmounts
							amounts={QUICK_AMOUNTS}
							value={amountValue}
							onPick={(quick) => {
								setAmount(String(quick))
								touch()
							}}
						/>
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
						{source && source.balance !== null ? (
							<p className="text-xs text-muted-foreground">
								{t("account.balance")}: {money(source.balance)}
							</p>
						) : null}
						{errors.amount ? <FieldError id="transfer-amount-error">{errors.amount}</FieldError> : null}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="transfer-reason">{t("transfer.reason")}</Label>
							{reasons.isPending ? (
								<Skeleton className="h-9 w-full" />
							) : reasons.isError ? (
								<FieldError>{t("transfer.reasonsError")}</FieldError>
							) : (
								<Select
									value={reasonCode}
									onValueChange={(value) => {
										setReasonCode(value)
										touch()
									}}
								>
									<SelectTrigger id="transfer-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
										<SelectValue placeholder={t("transfer.chooseReason")} />
									</SelectTrigger>
									<SelectContent>
										{reasons.data.map((candidate) => (
											<SelectItem key={candidate.code} value={candidate.code}>
												{candidate.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
							{errors.reason ? <FieldError>{errors.reason}</FieldError> : null}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="transfer-description">
								{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
							</Label>
							<Input id="transfer-description" value={description} onChange={(event) => setDescription(event.target.value)} />
						</div>
					</div>
				</StepSection>
			</TransferFormLayout>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						// What was typed for the account does not outlive the dialog.
						setPassword("")
						setConfirming(false)
					}}
					title={t("transfer.confirmTitle")}
					description={t("transfer.confirmQuestion")}
					summary={[
						{label: t("transfer.sourceAccount"), value: <span dir="ltr">{source?.number}</span>},
						{label: t("transfer.destinationAccount"), value: <span dir="ltr">{owner?.number}</span>},
						{label: t("transfer.holderLabel"), value: owner?.name},
						{label: t("transfer.amount"), amount: true, value: money(amountValue)},
						...(reason ? [{label: t("transfer.reason"), value: reason.name}] : []),
						...(description.trim() !== "" ? [{label: t("transfer.description"), value: description.trim()}] : []),
					]}
					confirmLabel={t("transfer.confirm")}
					pendingLabel={t("transfer.sending")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword
						requirement={requirement}
						accountNumber={source?.number ?? ""}
						codeServiceName={CODE_SERVICE}
						amount={amountValue}
						value={password}
						onChange={setPassword}
						disabled={sending.pending}
					/>
				</ConfirmDialog>
			) : null}
		</>
	)
}
