import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import {
	AMOUNT_INPUT_CLASS,
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
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
import {
	intraTransfer,
	type IntraTransferKind,
} from "@/features/branch/api/intra"
import {
	SignedPdfUpload,
	type SignedPdf,
} from "@/features/branch/components/signed-pdf-upload"
import type { SourceAccount } from "@/features/transaction/api/transaction"
import {
	AccountPassword,
	isPasswordComplete,
	usePasswordRequirement,
} from "@/features/transaction/components/account-password"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { SourceAccountSelect } from "@/features/transaction/components/source-account-select"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"
import {
	getAccountOwner,
	getIbanHolder,
	type AccountOwner,
	type IbanHolder,
} from "@/features/transfer/api/transfer"
import { reasonCodesOptions } from "@/features/transfer/api/transfer.queries"
import {
	bankCodeOf,
	isValidIban,
	MASKAN_BANK_CODE,
} from "@/features/transfer/lib/numbers"
import { formatAmount } from "@/lib/format"
import { normalizeDigits } from "@/lib/normalize-digits"
import { cn } from "@/lib/utils"

// The bank's names for the service on an account, one per kind of transfer: which accounts may do it, the limit and the SMS code.
const SERVICES: Record<IntraTransferKind, string> = {
	internal: "IntraInternalTransferMoney",
	satna: "IntraSatnaTransferMoney",
	paya: "IntraPayaTransferMoney",
}
const KINDS: IntraTransferKind[] = ["internal", "satna", "paya"]
const digits = (value: string): string =>
	normalizeDigits(value).replace(/\D/g, "")

/** A transfer made through the branch: like an ordinary transfer, plus a signed PDF that the bank checks. */
export default function BranchTransferPage() {
	const { t, i18n } = useTranslation()
	const language = i18n.language
	const reasons = useQuery(reasonCodesOptions(language))
	const [kind, setKind] = useState<IntraTransferKind>("internal")
	const service = SERVICES[kind]
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [destination, setDestination] = useState("")
	const [owner, setOwner] = useState<AccountOwner | null>(null)
	const [holder, setHolder] = useState<IbanHolder | null>(null)
	const [firstName, setFirstName] = useState("")
	const [lastName, setLastName] = useState("")
	const [amount, setAmount] = useState("")
	const [description, setDescription] = useState("")
	const [paymentId, setPaymentId] = useState("")
	const [reasonCode, setReasonCode] = useState("")
	const [document, setDocument] = useState<SignedPdf | null>(null)
	const [problem, setProblem] = useState("")
	const [lookupProblem, setLookupProblem] = useState("")
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const value = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((item) => item.code === reasonCode)
	const requirement = usePasswordRequirement({
		accountId: confirming ? (source?.id ?? null) : null,
		limitServiceName: service,
		amount: value,
	})
	const money = (number: number): string =>
		`${formatAmount(number, language)} ${t("transfer.rial")}`
	const iban = kind !== "internal"
	const holderName = holder
		? holder.withoutInquiry
			? `${firstName.trim()} ${lastName.trim()}`.trim()
			: holder.name
		: (owner?.name ?? "")

	const lookUp = useMutation({
		mutationFn: async () => {
			if (kind === "internal")
				return { owner: await getAccountOwner(destination), holder: null }
			if (!isValidIban(destination))
				throw new Error(t("transfer.iban.error.format"))
			if (bankCodeOf(destination) === MASKAN_BANK_CODE)
				throw new Error(t("transfer.iban.error.ownBank"))
			return { owner: null, holder: await getIbanHolder(destination, kind) }
		},
		onSuccess: (found) => {
			setLookupProblem("")
			setOwner(found.owner)
			setHolder(found.holder)
		},
		onError: (error: Error) => {
			setOwner(null)
			setHolder(null)
			setLookupProblem(error.message || t("branch.transfer.error.lookup"))
		},
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (
				!source ||
				!document ||
				requirement.state !== "ready" ||
				(!owner && !holder)
			)
				throw new Error("form incomplete")
			return intraTransfer({
				kind,
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				destination: holder ? holder.iban : (owner?.number ?? destination),
				destinationOwner: holderName,
				destinationFirstName: holder
					? holder.withoutInquiry
						? firstName.trim()
						: holder.firstName
					: (owner?.firstName ?? ""),
				destinationLastName: holder
					? holder.withoutInquiry
						? lastName.trim()
						: holder.lastName
					: (owner?.lastName ?? ""),
				destinationBank: holder ? bankCodeOf(holder.iban) : MASKAN_BANK_CODE,
				withoutInquiry: holder?.withoutInquiry === true,
				amount: value,
				paymentId: paymentId.trim(),
				description: description.trim(),
				reasonCode,
				document: document.base64,
			})
		},
		again: {
			to: routeMap.branchTransfer.path,
			label: t("branch.transfer.again"),
		},
		failedText: t("branch.transfer.failed"),
		uncertainText: t("branch.transfer.uncertain"),
	})

	const changeKind = (next: IntraTransferKind): void => {
		setKind(next)
		setSource(null)
		setDestination("")
		setOwner(null)
		setHolder(null)
		setLookupProblem("")
		setProblem("")
	}

	const review = (): void => {
		if (!source) return setProblem(t("branch.transfer.error.source"))
		if (!owner && !holder)
			return setProblem(t("branch.transfer.error.destination"))
		if (
			holder?.withoutInquiry &&
			(firstName.trim() === "" || lastName.trim() === "")
		)
			return setProblem(t("transfer.iban.error.name"))
		if (value <= 0) return setProblem(t("branch.transfer.error.amount"))
		if (description.trim() === "")
			return setProblem(t("branch.transfer.error.description"))
		if ((reasons.data?.length ?? 0) > 0 && !reason)
			return setProblem(t("branch.transfer.error.reason"))
		if (!document) return setProblem(t("branch.error.document"))
		setProblem("")
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	const templateHref =
		kind === "internal"
			? "/files/Transaction-Document-Internal%20Transfer.docx"
			: "/files/Transaction-Document-Satna-Paya.docx"

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("branch.transfer.title")}</h1>
			<p className="text-muted-foreground text-sm">
				{t("branch.transfer.hint")}
			</p>

			<FlowLayout
				aside={
					<FlowSummary
						id="bt-summary"
						title={t("branch.transfer.summary")}
						amount={value > 0 ? money(value) : null}
						rows={[
							{
								label: t("branch.transfer.kind"),
								value: t(`branch.transfer.kinds.${kind}`),
							},
							{
								label: t("branch.transfer.source"),
								value: source ? source.number : null,
							},
							{
								label: t("branch.transfer.holder"),
								value: holderName !== "" ? holderName : null,
							},
						]}
						reviewLabel={t("branch.review")}
						onReview={review}
					/>
				}
			>
				<StepSection
					id="bt-from-step"
					step={1}
					title={t("branch.transfer.fromStep")}
				>
					<div
						className="flex flex-wrap gap-3"
						role="radiogroup"
						aria-label={t("branch.transfer.kind")}
					>
						{KINDS.map((item) => (
							<label
								key={item}
								className={cn(
									"bg-card focus-within:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm transition-colors focus-within:ring-[3px]",
									kind === item
										? "border-primary bg-primary-soft ring-primary/20 ring-2"
										: "hover:border-foreground/40",
								)}
							>
								<input
									type="radio"
									name="bt-kind"
									className="accent-primary"
									checked={kind === item}
									onChange={() => changeKind(item)}
								/>
								{t(`branch.transfer.kinds.${item}`)}
							</label>
						))}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="bt-source">{t("branch.transfer.source")}</Label>
						<SourceAccountSelect
							id="bt-source"
							serviceName={service}
							value={source?.id ?? null}
							onChange={setSource}
						/>
					</div>
				</StepSection>

				<StepSection
					id="bt-to-step"
					step={2}
					title={t("branch.transfer.toStep")}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="bt-destination">
							{iban
								? t("branch.transfer.destinationIban")
								: t("branch.transfer.destinationAccount")}
						</Label>
						<div className="flex flex-wrap items-center gap-2">
							{iban ? (
								<span dir="ltr" className="text-muted-foreground text-sm">
									IR
								</span>
							) : null}
							<Input
								id="bt-destination"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={iban ? 24 : 20}
								className="max-w-72"
								value={destination}
								onChange={(event) => {
									setDestination(digits(event.target.value))
									setOwner(null)
									setHolder(null)
								}}
							/>
							<Button
								type="button"
								variant="outline"
								disabled={lookUp.isPending || destination === ""}
								onClick={() => lookUp.mutate()}
							>
								{lookUp.isPending
									? t("branch.transfer.looking")
									: t("branch.transfer.lookUp")}
							</Button>
						</div>
						{owner ? (
							<p className="text-success text-sm font-medium">
								{t("transfer.holder", { name: owner.name })}
							</p>
						) : null}
						{holder && !holder.withoutInquiry ? (
							<p className="text-success text-sm font-medium">
								{t("transfer.holder", { name: holder.name })}
							</p>
						) : null}
						{holder?.withoutInquiry ? (
							<p className="text-muted-foreground text-sm">
								{holder.note || t("transfer.iban.withoutInquiry")}
							</p>
						) : null}
						{lookupProblem ? (
							<p role="alert" className="text-destructive text-sm">
								{lookupProblem}
							</p>
						) : null}
					</div>
					{holder?.withoutInquiry ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-2">
								<Label htmlFor="bt-first">
									{t("branch.transfer.firstName")}
								</Label>
								<Input
									id="bt-first"
									maxLength={50}
									value={firstName}
									onChange={(event) => setFirstName(event.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="bt-last">{t("branch.transfer.lastName")}</Label>
								<Input
									id="bt-last"
									maxLength={50}
									value={lastName}
									onChange={(event) => setLastName(event.target.value)}
								/>
							</div>
						</div>
					) : null}
				</StepSection>

				<StepSection
					id="bt-details-step"
					step={3}
					title={t("branch.transfer.detailsStep")}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="bt-amount">{t("branch.transfer.amount")}</Label>
						<Input
							id="bt-amount"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={16}
							className={AMOUNT_INPUT_CLASS}
							value={amount}
							onChange={(event) =>
								setAmount(digits(event.target.value).replace(/^0+/, ""))
							}
						/>
						{amount !== "" ? (
							<p className="text-muted-foreground text-sm">{money(value)}</p>
						) : null}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="bt-reason">{t("branch.transfer.reason")}</Label>
						{reasons.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : (
							<Select value={reasonCode} onValueChange={setReasonCode}>
								<SelectTrigger id="bt-reason" className="w-full">
									<SelectValue placeholder={t("transfer.chooseReason")} />
								</SelectTrigger>
								<SelectContent>
									{(reasons.data ?? []).map((item) => (
										<SelectItem key={item.code} value={item.code}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					{iban ? (
						<div className="flex flex-col gap-2">
							<Label htmlFor="bt-payment">
								{t("branch.transfer.paymentId")}{" "}
								<span className="text-muted-foreground font-normal">
									({t("cheque.register.optional")})
								</span>
							</Label>
							<Input
								id="bt-payment"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={30}
								className="max-w-72"
								value={paymentId}
								onChange={(event) => setPaymentId(digits(event.target.value))}
							/>
						</div>
					) : null}
					<div className="flex flex-col gap-2">
						<Label htmlFor="bt-description">
							{t("branch.transfer.description")}
						</Label>
						<Input
							id="bt-description"
							maxLength={250}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</div>
				</StepSection>

				<StepSection
					id="bt-document-step"
					step={4}
					title={t("branch.transfer.documentStep")}
				>
					<SignedPdfUpload
						value={document}
						onChange={setDocument}
						accountNumber={source?.number ?? null}
						templateHref={templateHref}
						invalid={problem !== "" && !document}
					/>
					{problem ? <FieldError>{problem}</FieldError> : null}
					<div>
						<Button asChild variant="outline">
							<Link to={routeMap.branch.path}>{t("branch.menu.back")}</Link>
						</Button>
					</div>
				</StepSection>
			</FlowLayout>

			{confirming && source && document ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setPassword("")
						setConfirming(false)
					}}
					title={t("branch.transfer.confirmTitle")}
					description={t("branch.transfer.confirmQuestion")}
					summary={[
						{
							label: t("branch.transfer.source"),
							value: <span dir="ltr">{source.number}</span>,
						},
						{
							label: iban
								? t("branch.transfer.destinationIban")
								: t("branch.transfer.destinationAccount"),
							value: (
								<span dir="ltr">{`${iban ? "IR" : ""}${holder?.iban ?? owner?.number ?? destination}`}</span>
							),
						},
						{ label: t("branch.transfer.holder"), value: holderName },
						{
							label: t("branch.transfer.amount"),
							amount: true,
							value: money(value),
						},
						{
							label: t("branch.upload.file"),
							value: <span dir="ltr">{document.name}</span>,
						},
					]}
					confirmLabel={t("branch.transfer.confirm")}
					pendingLabel={t("branch.sending")}
					canConfirm={
						isPasswordComplete(requirement, password) && !sending.blocked
					}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword
						requirement={requirement}
						accountNumber={source.number}
						codeServiceName={service}
						amount={value}
						value={password}
						onChange={setPassword}
						disabled={sending.pending}
					/>
				</ConfirmDialog>
			) : null}
		</div>
	)
}
