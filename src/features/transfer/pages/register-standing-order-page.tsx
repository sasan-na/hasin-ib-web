import {useMutation, useQuery} from "@tanstack/react-query"
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
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {registerStandingOrder} from "@/features/transfer/api/standing-order"
import {getAccountOwner} from "@/features/transfer/api/transfer"
import {frequenciesOptions, reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
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

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-sm text-destructive">
				{message}
			</p>
		) : null

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("transfer.standing.registerTitle")}</h1>

			<section aria-labelledby="so-from" className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<h2 id="so-from" className="text-base font-semibold">
					{t("transfer.from")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="so-source">{t("transfer.sourceAccount")}</Label>
					<SourceAccountSelect
						id="so-source"
						serviceName={SERVICE}
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

			<section aria-labelledby="so-to" className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<h2 id="so-to" className="text-base font-semibold">
					{t("transfer.to")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="so-destination">{t("transfer.destinationAccount")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="so-destination"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={15}
							value={destination}
							aria-invalid={errors.destination !== undefined}
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
						<Button type="button" variant="outline" disabled={lookup.isPending || destination === ""} onClick={check}>
							{lookup.isPending ? t("transfer.checking") : t("transfer.check")}
						</Button>
					</div>
					{owner ? (
						<p role="status" className="text-sm font-medium text-success">
							{t("transfer.holder", {name: owner.name || owner.number})}
						</p>
					) : null}
					{lookup.isError ? error(lookup.error.message || t("transfer.lookupFailed")) : null}
					{error(errors.destination)}
				</div>
			</section>

			<section aria-labelledby="so-details" className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<h2 id="so-details" className="text-base font-semibold">
					{t("transfer.details")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="so-amount">{t("transfer.amount")}</Label>
					<Input
						id="so-amount"
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
					{error(errors.amount)}
				</div>
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
						onChange={(event) => {
							setStartDate(event.target.value)
							touch()
						}}
					/>
					<p className="text-xs text-muted-foreground">{t("transfer.standing.startDateHint")}</p>
					{error(errors.date)}
				</div>
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
							error(t("transfer.standing.frequenciesError"))
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
					{error(errors.frequency)}
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
						onChange={(event) => {
							setRepeat(digits(event.target.value))
							touch()
						}}
					/>
					{error(errors.repeat)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="so-reason">{t("transfer.reason")}</Label>
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
					{error(errors.reason)}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="so-description">
						{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
					</Label>
					<Input id="so-description" value={description} onChange={(event) => setDescription(event.target.value)} />
				</div>
			</section>

			<div>
				<Button type="button" onClick={review}>
					{t("transfer.standing.review")}
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
		</div>
	)
}
