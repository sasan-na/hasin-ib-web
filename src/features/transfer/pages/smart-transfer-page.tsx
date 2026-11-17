import {useMutation, useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {getAccountOwner, transferInternal} from "@/features/transfer/api/transfer"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
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

	const [source, setSource] = useState<SourceAccount | null>(null)
	const [destination, setDestination] = useState("")
	const [amount, setAmount] = useState("")
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
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("transfer.smart.title")}</h1>

			<section aria-labelledby="transfer-from" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="transfer-from" className="text-base font-semibold">
					{t("transfer.from")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="transfer-source">{t("transfer.sourceAccount")}</Label>
					<SourceAccountSelect
						id="transfer-source"
						serviceName={SOURCE_SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							touch()
						}}
						invalid={errors.source !== undefined}
					/>
					{errors.source ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.source}
						</p>
					) : null}
				</div>
			</section>

			<section aria-labelledby="transfer-to" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="transfer-to" className="text-base font-semibold">
					{t("transfer.to")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="transfer-destination">{t("transfer.destinationAccount")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="transfer-destination"
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
					{lookup.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{lookup.error.message || t("transfer.lookupFailed")}
						</p>
					) : null}
					{errors.destination ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.destination}
						</p>
					) : null}
				</div>
			</section>

			<section aria-labelledby="transfer-details" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="transfer-details" className="text-base font-semibold">
					{t("transfer.details")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="transfer-amount">{t("transfer.amount")}</Label>
					<Input
						id="transfer-amount"
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
					{errors.amount ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.amount}
						</p>
					) : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="transfer-reason">{t("transfer.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : reasons.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("transfer.reasonsError")}
						</p>
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
					{errors.reason ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.reason}
						</p>
					) : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="transfer-description">
						{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
					</Label>
					<Input id="transfer-description" value={description} onChange={(event) => setDescription(event.target.value)} />
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
						{label: t("transfer.amount"), value: <strong>{money(amountValue)}</strong>},
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
		</div>
	)
}
