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
import {registerStandingOrder} from "@/features/transfer/api/standing-order"
import {getAccountOwner} from "@/features/transfer/api/transfer"
import {frequenciesOptions, reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {SourceAccountCards} from "@/features/transfer/components/source-account-cards"
import {FieldError, HolderCard, AMOUNT_INPUT_CLASS, PayeeShortcuts, QuickAmounts, StepSection, TransferFormLayout, TransferSummary} from "@/features/transfer/components/transfer-form"
import {formatAmount} from "@/lib/format"
import {jalaliToIso, parseJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for this service, for the paying accounts, the limit and the SMS code.
const SERVICE = "RegisterStandingOrder"
const ACCOUNT_PATTERN = /^\d{5,15}$/
// The server refuses more than 999 repetitions.
const MAX_REPEAT = 999

type Errors = Partial<Record<"source" | "destination" | "amount" | "reason" | "date" | "frequency" | "repeat", string>>

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Set up a standing order: a payment from one of your accounts to another Maskan account, repeated on a schedule. */
export default function RegisterStandingOrderPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const reasons = useQuery(reasonCodesOptions(language))
	const frequencies = useQuery(frequenciesOptions(language))

	const [source, setSource] = useState<SourceAccount | null>(null)
	const [destination, setDestination] = useState("")
	const [amount, setAmount] = useState("")
	const [startDate, setStartDate] = useState("")
	const [every, setEvery] = useState("1")
	const [frequencyType, setFrequencyType] = useState("")
	const [repeat, setRepeat] = useState("1")
	const [reasonCode, setReasonCode] = useState("")
	const [description, setDescription] = useState("")
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const lookup = useMutation({mutationFn: getAccountOwner})
	const owner = lookup.data
	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const frequency = frequencies.data?.find((candidate) => String(candidate.value) === frequencyType)
	const isoStart = ((): string | null => {
		const parsed = parseJalali(startDate)
		return parsed ? jalaliToIso(parsed) : null
	})()
	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: SERVICE, amount: amountValue})

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || !owner || !isoStart || !frequency || requirement.state !== "ready") throw new Error("form incomplete")
			return registerStandingOrder({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				destinationAccountNumber: owner.number,
				destinationOwner: owner.name,
				startDate: isoStart,
				frequencyNo: Number(every),
				frequencyType: frequency.value,
				repeatNo: Number(repeat),
				amount: amountValue,
				description: description.trim(),
				reasonCode,
			})
		},
		again: {to: routeMap.transferStandingOrders.path, label: t("transfer.standing.backToList")},
		failedText: t("transfer.standing.registerFailed"),
		uncertainText: t("transfer.standing.registerUncertain"),
	})

	const touch = (): void => setErrors({})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("transfer.rial")}`

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
		if (!isoStart || isoStart <= new Date().toISOString().slice(0, 10)) found.date = t("transfer.standing.error.date")
		if (Number(every) < 1) found.frequency = t("transfer.standing.error.every")
		if (!frequency) found.frequency = t("transfer.standing.error.frequency")
		if (Number(repeat) < 1 || Number(repeat) > MAX_REPEAT) found.repeat = t("transfer.standing.error.repeat", {max: MAX_REPEAT})
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
				title={t("transfer.standing.registerTitle")}
				aside={
					<TransferSummary
						id="so-summary"
						title={t("transfer.summary")}
						amount={amountValue > 0 ? money(amountValue) : null}
						rows={[
							{label: t("transfer.sourceAccount"), value: source ? source.name || source.type : null},
							{label: t("transfer.holderLabel"), value: owner ? owner.name || owner.number : null},
							{label: t("transfer.standing.frequency"), value: frequency && Number(every) > 0 ? t("transfer.standing.every", {count: Number(every), unit: frequency.title}) : null},
							{label: t("transfer.reason"), value: reason?.name ?? null},
						]}
						reviewLabel={t("transfer.standing.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="so-from" step={1} title={t("transfer.from")}>
					<p id="so-source-label" className="sr-only">
						{t("transfer.sourceAccount")}
					</p>
					<SourceAccountCards
						serviceName={SERVICE}
						value={source?.id ?? null}
						labelledBy="so-source-label"
						onChange={(account) => {
							setSource(account)
							touch()
						}}
					/>
					{errors.source ? <FieldError>{errors.source}</FieldError> : null}
				</StepSection>

				<StepSection id="so-to" step={2} title={t("transfer.to")}>
					<div className="flex flex-col gap-2">
						<PayeeShortcuts
							kind="accounts"
							onPick={(number) => {
								setDestination(number)
								lookup.reset()
								touch()
							}}
						/>
						<Label htmlFor="so-destination">{t("transfer.destinationAccount")}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="so-destination"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={15}
								className="h-11 text-base"
								value={destination}
								aria-invalid={errors.destination !== undefined}
								aria-describedby={errors.destination !== undefined ? "so-destination-error" : undefined}
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
						{errors.destination ? <FieldError id="so-destination-error">{errors.destination}</FieldError> : null}
					</div>
				</StepSection>

				<StepSection id="so-details" step={3} title={t("transfer.details")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="so-amount">{t("transfer.amount")}</Label>
						<Input
							id="so-amount"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={15}
							className={AMOUNT_INPUT_CLASS}
							value={amount}
							aria-invalid={errors.amount !== undefined}
							aria-describedby={errors.amount !== undefined ? "so-amount-error" : undefined}
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
						{errors.amount ? <FieldError id="so-amount-error">{errors.amount}</FieldError> : null}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="so-reason">{t("transfer.reason")}</Label>
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
									<SelectTrigger id="so-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
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
							<Label htmlFor="so-description">
								{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
							</Label>
							<Input id="so-description" value={description} onChange={(event) => setDescription(event.target.value)} />
						</div>
					</div>
				</StepSection>

				<StepSection id="so-schedule" step={4} title={t("transfer.standing.schedule")}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="so-start">{t("transfer.standing.startDate")}</Label>
						<Input
							id="so-start"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							placeholder="1405/01/01"
							className="max-w-48"
							value={startDate}
							aria-invalid={errors.date !== undefined}
							aria-describedby={errors.date !== undefined ? "so-start-error" : undefined}
							onChange={(event) => {
								setStartDate(event.target.value)
								touch()
							}}
						/>
						<p className="text-xs text-muted-foreground">{t("transfer.standing.startDateHint")}</p>
						{errors.date ? <FieldError id="so-start-error">{errors.date}</FieldError> : null}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label htmlFor="so-every">{t("transfer.standing.repeatEvery")}</Label>
							<div className="flex items-center gap-2">
								<Input
									id="so-every"
									dir="ltr"
									inputMode="numeric"
									className="w-24"
									maxLength={3}
									value={every}
									aria-invalid={errors.frequency !== undefined}
									onChange={(event) => {
										setEvery(digits(event.target.value))
										touch()
									}}
								/>
								{frequencies.isPending ? (
									<Skeleton className="h-9 w-40" />
								) : frequencies.isError ? (
									<FieldError>{t("transfer.standing.frequenciesError")}</FieldError>
								) : (
									<Select
										value={frequencyType}
										onValueChange={(value) => {
											setFrequencyType(value)
											touch()
										}}
									>
										<SelectTrigger className="w-44" aria-label={t("transfer.standing.frequency")}>
											<SelectValue placeholder={t("transfer.standing.chooseFrequency")} />
										</SelectTrigger>
										<SelectContent>
											{frequencies.data.map((candidate) => (
												<SelectItem key={candidate.value} value={String(candidate.value)}>
													{candidate.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</div>
							{errors.frequency ? <FieldError>{errors.frequency}</FieldError> : null}
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="so-repeat">{t("transfer.standing.repeatCount")}</Label>
							<Input
								id="so-repeat"
								dir="ltr"
								inputMode="numeric"
								className="w-24"
								maxLength={3}
								value={repeat}
								aria-invalid={errors.repeat !== undefined}
								aria-describedby={errors.repeat !== undefined ? "so-repeat-error" : undefined}
								onChange={(event) => {
									setRepeat(digits(event.target.value))
									touch()
								}}
							/>
							{errors.repeat ? <FieldError id="so-repeat-error">{errors.repeat}</FieldError> : null}
						</div>
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
					title={t("transfer.standing.confirmTitle")}
					description={t("transfer.standing.confirmQuestion")}
					summary={[
						{label: t("transfer.sourceAccount"), value: <span dir="ltr">{source?.number}</span>},
						{label: t("transfer.destinationAccount"), value: <span dir="ltr">{owner?.number}</span>},
						{label: t("transfer.holderLabel"), value: owner?.name},
						{label: t("transfer.amount"), amount: true, value: money(amountValue)},
						{label: t("transfer.standing.firstDate"), value: <span dir="ltr">{parseJalali(startDate)}</span>},
						{label: t("transfer.standing.frequency"), value: t("transfer.standing.every", {count: Number(every), unit: frequency?.title ?? ""})},
						{label: t("transfer.standing.repeatCount"), value: Number(repeat)},
						...(reason ? [{label: t("transfer.reason"), value: reason.name}] : []),
						...(description.trim() !== "" ? [{label: t("transfer.description"), value: description.trim()}] : []),
					]}
					confirmLabel={t("transfer.standing.registerConfirm")}
					pendingLabel={t("transfer.standing.registering")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword
						requirement={requirement}
						accountNumber={source?.number ?? ""}
						codeServiceName={SERVICE}
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
