import {useMutation, useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {getIbanHolder, transferIban, type IbanNetwork} from "@/features/transfer/api/transfer"
import {ibanLimitsOptions, reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {bankCodeOf, isValidIban, MASKAN_BANK_CODE} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Errors = Partial<Record<"source" | "iban" | "name" | "amount" | "reason", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Send money to an account at another bank by its IBAN, over Paya (next working day, any amount) or Satna (same day, large amounts). */
export default function IbanTransferPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const [params, setParams] = useSearchParams()
	const network: IbanNetwork = params.get("type") === "paya" ? "paya" : "satna"
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
		again: {to: `${routeMap.transferIban.path}?type=${network}`, label: t("transfer.again")},
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

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-sm text-destructive">
				{message}
			</p>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("transfer.iban.title")}</h1>

			<section aria-labelledby="iban-network" className="flex flex-col gap-3 rounded-lg border bg-card p-5">
				<h2 id="iban-network" className="text-base font-semibold">
					{t("transfer.iban.network")}
				</h2>
				<RadioGroup
					value={network}
					onValueChange={(value) => {
						setParams({type: value === "paya" ? "paya" : "satna"}, {replace: true})
						// Another network means other limits and another set of paying accounts.
						setSource(null)
						lookup.reset()
						touch()
					}}
					className="gap-3"
				>
					{(["satna", "paya"] as const).map((option) => (
						<div key={option} className="flex items-start gap-3">
							<RadioGroupItem id={`iban-${option}`} value={option} className="mt-1" />
							<Label htmlFor={`iban-${option}`} className="flex flex-col items-start gap-0.5">
								<span>{t(`transfer.iban.${option}`)}</span>
								<span className="text-sm font-normal text-muted-foreground">{t(`transfer.iban.${option}Hint`)}</span>
							</Label>
						</div>
					))}
				</RadioGroup>
			</section>

			<section aria-labelledby="iban-from" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="iban-from" className="text-base font-semibold">
					{t("transfer.from")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="iban-source">{t("transfer.sourceAccount")}</Label>
					<SourceAccountSelect
						key={service}
						id="iban-source"
						serviceName={service}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							touch()
						}}
						invalid={errors.source !== undefined}
					/>
					{error(errors.source)}
				</div>
			</section>

			<section aria-labelledby="iban-to" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="iban-to" className="text-base font-semibold">
					{t("transfer.to")}
				</h2>
				<div className="flex flex-col gap-2">
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
							value={iban}
							aria-invalid={errors.iban !== undefined}
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
						<Button type="button" variant="outline" disabled={lookup.isPending || iban === ""} onClick={check}>
							{lookup.isPending ? t("transfer.checking") : t("transfer.check")}
						</Button>
					</div>
					{holder && !holder.withoutInquiry ? (
						<p role="status" className="text-sm font-medium text-success">
							{t("transfer.holder", {name: holder.name})}
						</p>
					) : null}
					{holder?.withoutInquiry ? <p className="text-sm text-muted-foreground">{holder.note || t("transfer.iban.withoutInquiry")}</p> : null}
					{lookup.isError ? error(lookup.error.message || t("transfer.lookupFailed")) : null}
					{error(errors.iban)}
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
						<div className="sm:col-span-2">{error(errors.name)}</div>
					</div>
				) : null}
			</section>

			<section aria-labelledby="iban-details" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="iban-details" className="text-base font-semibold">
					{t("transfer.details")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="iban-amount">{t("transfer.amount")}</Label>
					<Input
						id="iban-amount"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={15}
						className="max-w-72"
						value={amount}
						aria-invalid={errors.amount !== undefined}
						onChange={(event) => {
							setAmount(digits(event.target.value).replace(/^0+/, ""))
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
					{error(errors.amount)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="iban-payment-id">
						{t("transfer.iban.paymentId")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
					</Label>
					<Input id="iban-payment-id" dir="ltr" inputMode="numeric" maxLength={30} className="max-w-72" value={paymentId} onChange={(event) => setPaymentId(digits(event.target.value))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="iban-reason">{t("transfer.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : reasons.isError ? (
						error(t("transfer.reasonsError"))
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
					{error(errors.reason)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="iban-description">
						{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
					</Label>
					<Input id="iban-description" value={description} onChange={(event) => setDescription(event.target.value)} />
				</div>
			</section>

			<div>
				<Button type="button" onClick={review}>
					{t("transfer.review")}
				</Button>
			</div>

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
		</div>
	)
}
