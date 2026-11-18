import {useMutation, useQuery} from "@tanstack/react-query"
import {Loader2, Search} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {getIbanHolder, transferIban, type IbanNetwork} from "@/features/transfer/api/transfer"
import {ibanLimitsOptions, reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {SourceAccountCards} from "@/features/transfer/components/source-account-cards"
import {FieldError, HolderCard, AMOUNT_INPUT_CLASS, PayeeShortcuts, QuickAmounts, StepSection, TransferFormLayout, TransferSummary} from "@/features/transfer/components/transfer-form"
import {bankCodeOf, isValidIban, MASKAN_BANK_CODE} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Errors = Partial<Record<"source" | "iban" | "name" | "amount" | "reason", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Send money to an account at another bank by its IBAN, over Paya (next working day, any amount) or Satna (same day, large amounts). */
/** The IBAN transfer for one network; the page around it picks the network. */
export function IbanTransferForm({network}: {network: IbanNetwork}) {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	// The bank names the service after the network; it decides which accounts may pay, the limit and the SMS code.
	const service = network === "paya" ? "PayaTransferMoney" : "SatnaTransferMoney"

	const reasons = useQuery(reasonCodesOptions(language))
	const limits = useQuery(ibanLimitsOptions(network))

	const [source, setSource] = useState<SourceAccount | null>(null)
	const [iban, setIban] = useState("")
	const [firstName, setFirstName] = useState("")
	const [lastName, setLastName] = useState("")
	const [amount, setAmount] = useState("")
	const [paymentId, setPaymentId] = useState("")
	const [reasonCode, setReasonCode] = useState("")
	const [description, setDescription] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const lookup = useMutation({mutationFn: () => getIbanHolder(iban, network)})
	const holder = lookup.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const holderName = holder ? (holder.withoutInquiry ? `${firstName.trim()} ${lastName.trim()}`.trim() : holder.name) : ""
	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: service, amount: amountValue})

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || !holder || requirement.state !== "ready") throw new Error("form incomplete")
			return transferIban({
				network,
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				holder,
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				bankCode: bankCodeOf(holder.iban),
				amount: amountValue,
				paymentId: paymentId.trim(),
				description: description.trim(),
				reasonCode,
			})
		},
		again: {to: `${routeMap.transferSmart.path}?type=${network}`, label: t("transfer.again")},
		failedText: t("transfer.failed"),
		uncertainText: t("transfer.uncertain"),
	})

	const touch = (): void => setErrors({})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("transfer.rial")}`

	const ibanProblem = (): string | null => {
		if (!isValidIban(iban)) return t("transfer.iban.error.format")
		if (bankCodeOf(iban) === MASKAN_BANK_CODE) return t("transfer.iban.error.ownBank")
		return null
	}

	const check = (): void => {
		const problem = ibanProblem()
		if (problem) {
			setErrors({iban: problem})
			return
		}
		touch()
		lookup.mutate()
	}

	const review = (): void => {
		const found: Errors = {}
		const min = limits.data?.min ?? null
		const max = limits.data?.max ?? null
		if (!source) found.source = t("transfer.error.source")
		if (!holder) found.iban = ibanProblem() ?? t("transfer.iban.error.notChecked")
		else if (holder.withoutInquiry && (firstName.trim() === "" || lastName.trim() === "")) found.name = t("transfer.iban.error.name")
		if (amountValue <= 0) found.amount = t("transfer.error.amount")
		else if (min !== null && amountValue < min) found.amount = t("transfer.iban.error.min", {amount: money(min)})
		else if (max !== null && amountValue > max) found.amount = t("transfer.iban.error.max", {amount: money(max)})
		if ((reasons.data?.length ?? 0) > 0 && !reason) found.reason = t("transfer.error.reason")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<>
			<TransferFormLayout
				aside={
					<TransferSummary
						id="iban-summary"
						title={t("transfer.summary")}
						amount={amountValue > 0 ? money(amountValue) : null}
						rows={[
							{label: t("transfer.iban.network"), value: t(`transfer.iban.${network}`)},
							{label: t("transfer.sourceAccount"), value: source ? source.name || source.type : null},
							{label: t("transfer.holderLabel"), value: holderName !== "" ? holderName : null},
							{label: t("transfer.reason"), value: reason?.name ?? null},
						]}
						reviewLabel={t("transfer.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="iban-from" step={1} title={t("transfer.from")}>
					<p id="iban-source-label" className="sr-only">
						{t("transfer.sourceAccount")}
					</p>
					<SourceAccountCards
						key={service}
						serviceName={service}
						value={source?.id ?? null}
						labelledBy="iban-source-label"
						onChange={(account) => {
							setSource(account)
							touch()
						}}
					/>
					{errors.source ? <FieldError>{errors.source}</FieldError> : null}
				</StepSection>

				<StepSection id="iban-to" step={2} title={t("transfer.to")}>
					<div className="flex flex-col gap-2">
						<PayeeShortcuts
							kind="ibans"
							onPick={(number) => {
								setIban(number)
								lookup.reset()
								touch()
							}}
						/>
						<Label htmlFor="iban-number">{t("transfer.iban.number")}</Label>
						<div className="flex items-center gap-2">
							<span dir="ltr" className="font-medium text-muted-foreground">
								IR
							</span>
							<Input
								id="iban-number"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={24}
								className="h-11 text-base"
								value={iban}
								aria-invalid={errors.iban !== undefined}
								aria-describedby={errors.iban !== undefined ? "iban-number-error" : undefined}
								onChange={(event) => {
									setIban(digits(event.target.value.replace(/^\s*IR/i, "")))
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
							<Button type="button" variant="outline" className="h-11" disabled={lookup.isPending || iban === ""} onClick={check}>
								{lookup.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
								{lookup.isPending ? t("transfer.checking") : t("transfer.check")}
							</Button>
						</div>
						{holder && !holder.withoutInquiry ? <HolderCard label={t("transfer.holderLabel")} name={holder.name} /> : null}
						{holder?.withoutInquiry ? <p className="text-sm text-muted-foreground">{holder.note || t("transfer.iban.withoutInquiry")}</p> : null}
						{lookup.isError ? <FieldError>{lookup.error.message || t("transfer.lookupFailed")}</FieldError> : null}
						{errors.iban ? <FieldError id="iban-number-error">{errors.iban}</FieldError> : null}
					</div>
					{holder?.withoutInquiry ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="iban-first-name">{t("transfer.iban.firstName")}</Label>
								<Input id="iban-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} aria-invalid={errors.name !== undefined} />
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="iban-last-name">{t("transfer.iban.lastName")}</Label>
								<Input id="iban-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} aria-invalid={errors.name !== undefined} />
							</div>
							{errors.name ? (
								<div className="sm:col-span-2">
									<FieldError>{errors.name}</FieldError>
								</div>
							) : null}
						</div>
					) : null}
				</StepSection>

				<StepSection id="iban-details" step={3} title={t("transfer.details")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="iban-amount">{t("transfer.amount")}</Label>
						<Input
							id="iban-amount"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={15}
							className={AMOUNT_INPUT_CLASS}
							value={amount}
							aria-invalid={errors.amount !== undefined}
							aria-describedby={errors.amount !== undefined ? "iban-amount-error" : undefined}
							onChange={(event) => {
								setAmount(digits(event.target.value).replace(/^0+/, ""))
								touch()
							}}
						/>
						<QuickAmounts
							value={amountValue}
							onPick={(quick) => {
								setAmount(String(quick))
								touch()
							}}
						/>
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
						{limits.data && (limits.data.min !== null || limits.data.max !== null) ? (
							<p className="text-xs text-muted-foreground">
								{[
									limits.data.min !== null ? t("transfer.iban.minNote", {amount: money(limits.data.min)}) : null,
									limits.data.max !== null ? t("transfer.iban.maxNote", {amount: money(limits.data.max)}) : null,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
						) : null}
						{errors.amount ? <FieldError id="iban-amount-error">{errors.amount}</FieldError> : null}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="iban-reason">{t("transfer.reason")}</Label>
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
									<SelectTrigger id="iban-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
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
							<Label htmlFor="iban-payment-id">
								{t("transfer.iban.paymentId")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
							</Label>
							<Input id="iban-payment-id" dir="ltr" inputMode="numeric" maxLength={30} value={paymentId} onChange={(event) => setPaymentId(digits(event.target.value))} />
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="iban-description">
							{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
						</Label>
						<Input id="iban-description" value={description} onChange={(event) => setDescription(event.target.value)} />
					</div>
				</StepSection>
			</TransferFormLayout>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setPassword("")
						setConfirming(false)
					}}
					title={t("transfer.confirmTitle")}
					description={t("transfer.confirmQuestion")}
					summary={[
						{label: t("transfer.iban.network"), value: t(`transfer.iban.${network}`)},
						{label: t("transfer.sourceAccount"), value: <span dir="ltr">{source?.number}</span>},
						{label: t("transfer.iban.number"), value: <span dir="ltr">{`IR${holder?.iban ?? ""}`}</span>},
						{label: t("transfer.holderLabel"), value: holderName},
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
						codeServiceName={service}
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
