import {useMutation, useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {Textarea} from "@/components/ui/textarea"
import {getChakadActivated, issueChakadCheque, requestIssueSignature, type IssueRequest} from "@/features/cheque/api/chakad-issue"
import {checkRecipients, newRecipientRow, RecipientsEditor, toRecipients, type RecipientRow} from "@/features/cheque/components/recipients-editor"
import {getMyNationalCode} from "@/features/profile/api/profile"
import {sourceAccountsOptions} from "@/features/transaction/api/transaction.queries"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {isValidIban} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {parseJalali, todayJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for issuing a digital cheque: which accounts may do it, the limit and the SMS code.
const SERVICE = "ChequeIssue"

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Issue a digital cheque from your cheque book: what it says and who it is payable to, then approve it in the Hamoon app. */
export default function ChakadIssuePage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const [params] = useSearchParams()
	const accountId = Number(params.get("account"))
	const series = params.get("series") ?? ""
	const serial = params.get("serial") ?? ""
	const sayyadId = params.get("sayyad") ?? ""
	const known = Number.isInteger(accountId) && accountId > 0 && sayyadId !== ""

	const activated = useQuery({queryKey: ["cheque", "chakad-activated"], queryFn: getChakadActivated, staleTime: 60_000, retry: false})
	const accounts = useQuery({...sourceAccountsOptions(SERVICE, language), enabled: known})
	const reasons = useQuery(reasonCodesOptions(language))
	const account = accounts.data?.find((candidate) => candidate.id === accountId)

	const [dueDate, setDueDate] = useState("")
	const [amount, setAmount] = useState("")
	const [description, setDescription] = useState("")
	const [iban, setIban] = useState("")
	const [reasonCode, setReasonCode] = useState("")
	const [receivers, setReceivers] = useState<RecipientRow[]>(() => [newRecipientRow(1)])
	const [guarantors, setGuarantors] = useState<RecipientRow[]>([])
	const [errors, setErrors] = useState<Partial<Record<"dueDate" | "amount" | "description" | "iban" | "reason" | "receivers" | "guarantors", string>>>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")
	// The id of the approval the customer was asked for in the Hamoon app; set once the request has been sent.
	const [approval, setApproval] = useState<string | null>(null)
	const [signProblem, setSignProblem] = useState<string | null>(null)

	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const parsedDue = parseJalali(dueDate)
	const requirement = usePasswordRequirement({accountId: confirming ? (account?.id ?? null) : null, limitServiceName: SERVICE, amount: amountValue})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("cheque.rial")}`

	const build = (): IssueRequest => {
		if (!account || !parsedDue || requirement.state !== "ready") throw new Error("form incomplete")
		return {
			sourceAccountNumber: account.number,
			sourcePassword: requirement.needsPassword ? password : null,
			sourcePasswordType: requirement.info.type,
			sayyadId,
			dueDate: parsedDue.replace(/\D/g, ""),
			amount: amountValue,
			description: description.trim(),
			iban,
			reasonCode,
			receivers: toRecipients(receivers),
			guarantors: toRecipients(guarantors),
		}
	}

	const asking = useMutation({
		mutationFn: async () => requestIssueSignature(build(), await getMyNationalCode()),
		onSuccess: (id) => {
			setSignProblem(null)
			setApproval(id)
		},
		onError: (error: Error) => setSignProblem(error.message || t("cheque.issue.signFailed")),
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (!approval) throw new Error("not approved")
			return issueChakadCheque(build(), approval)
		},
		again: {to: routeMap.chequeList.path, label: t("cheque.block.backToList")},
		failedText: t("cheque.issue.failed"),
		uncertainText: t("cheque.issue.uncertain"),
	})

	const review = (): void => {
		const found: typeof errors = {}
		if (!parsedDue) found.dueDate = t("cheque.register.error.date")
		else if (parsedDue <= todayJalali()) found.dueDate = t("cheque.register.error.future")
		if (amountValue <= 0) found.amount = t("cheque.register.error.amount")
		if (description.trim() === "") found.description = t("cheque.register.error.description")
		if (iban !== "" && !isValidIban(iban)) found.iban = t("cheque.register.error.iban")
		if ((reasons.data?.length ?? 0) > 0 && !reason) found.reason = t("cheque.register.error.reason")
		const messages = {notChecked: t("cheque.register.error.notChecked"), duplicate: t("cheque.register.error.duplicate")}
		const checkedReceivers = checkRecipients(receivers, messages)
		setReceivers(checkedReceivers.rows)
		if (!checkedReceivers.ok) found.receivers = t("cheque.register.error.fixRecipients")
		const checkedGuarantors = checkRecipients(guarantors, messages)
		setGuarantors(checkedGuarantors.rows)
		if (!checkedGuarantors.ok) found.guarantors = t("cheque.register.error.fixRecipients")
		setErrors(found)
		if (Object.keys(found).length > 0) return
		setPassword("")
		setApproval(null)
		setSignProblem(null)
		sending.reset()
		setConfirming(true)
	}

	const close = (): void => {
		setPassword("")
		setApproval(null)
		setSignProblem(null)
		setConfirming(false)
	}

	const error = (message?: string) =>
		message ? (
			<p role="alert" className="text-sm text-destructive">
				{message}
			</p>
		) : null

	if (!known) {
		return (
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
				<h1 className="text-2xl font-bold">{t("cheque.issue.title")}</h1>
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("cheque.register.noCheque")}
				</p>
				<Button asChild variant="outline" className="self-start">
					<Link to={routeMap.chequeList.path}>{t("cheque.title")}</Link>
				</Button>
			</div>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.issue.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.issue.hint")}</p>

			{activated.data === false ? (
				<Alert variant="destructive">
					<AlertDescription>
						{t("cheque.issue.notActivated")}{" "}
						<Link to={routeMap.chakadActivate.path} className="underline">
							{t("cheque.issue.activate")}
						</Link>
					</AlertDescription>
				</Alert>
			) : null}

			{accounts.isPending ? (
				<Skeleton className="h-16 w-full" />
			) : !account ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("cheque.issue.noAccount")}
				</p>
			) : (
				<dl className="grid gap-3 rounded-lg border bg-card p-5 text-sm sm:grid-cols-3">
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("cheque.account")}</dt>
						<dd dir="ltr" className="font-medium">
							{account.number}
						</dd>
					</div>
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("cheque.serial")}</dt>
						<dd dir="ltr" className="font-medium">
							{series} / {serial}
						</dd>
					</div>
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("cheque.sayyadId")}</dt>
						<dd dir="ltr" className="font-medium">
							{sayyadId}
						</dd>
					</div>
				</dl>
			)}

			<form
				className="flex flex-col gap-5 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					review()
				}}
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="ci-due">{t("cheque.register.dueDate")}</Label>
						<Input id="ci-due" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={dueDate} aria-invalid={errors.dueDate !== undefined} onChange={(event) => setDueDate(normalizeDigits(event.target.value))} />
						{error(errors.dueDate)}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="ci-amount">{t("cheque.pichak.amount")}</Label>
						<Input id="ci-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={16} value={amount} aria-invalid={errors.amount !== undefined} onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))} />
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
						{error(errors.amount)}
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="ci-reason">{t("cheque.register.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : (
						<Select value={reasonCode} onValueChange={setReasonCode}>
							<SelectTrigger id="ci-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
								<SelectValue placeholder={t("cheque.register.chooseReason")} />
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
					{error(errors.reason)}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="ci-description">{t("cheque.pichak.description")}</Label>
					<Textarea id="ci-description" rows={3} maxLength={250} value={description} aria-invalid={errors.description !== undefined} onChange={(event) => setDescription(event.target.value)} />
					{error(errors.description)}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="ci-iban">
						{t("cheque.register.iban")} <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span>
					</Label>
					<div className="flex items-center gap-1" dir="ltr">
						<span className="text-sm text-muted-foreground">IR</span>
						<Input id="ci-iban" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={24} value={iban} aria-invalid={errors.iban !== undefined} onChange={(event) => setIban(digits(event.target.value))} />
					</div>
					{error(errors.iban)}
				</div>

				<RecipientsEditor sayyadId={sayyadId} rows={receivers} setRows={setReceivers} title={t("cheque.pichak.receivers")} />
				{error(errors.receivers)}

				<div className="flex flex-col gap-2">
					<RecipientsEditor sayyadId={sayyadId} rows={guarantors} setRows={setGuarantors} title={t("cheque.issue.guarantors")} minRows={0} />
					<p className="text-xs text-muted-foreground">{t("cheque.issue.guarantorsHint")}</p>
					{error(errors.guarantors)}
				</div>

				<div className="flex justify-end gap-2">
					<Button asChild variant="outline">
						<Link to={routeMap.chequeList.path}>{t("cheque.register.cancel")}</Link>
					</Button>
					<Button type="submit" disabled={!account || activated.data === false}>
						{t("cheque.register.review")}
					</Button>
				</div>
			</form>

			{confirming && account ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) close()
					}}
					title={t("cheque.issue.confirmTitle")}
					description={approval ? t("cheque.issue.approveQuestion") : t("cheque.issue.confirmQuestion")}
					summary={[
						{label: t("cheque.account"), value: <span dir="ltr">{account.number}</span>},
						{label: t("cheque.sayyadId"), value: <span dir="ltr">{sayyadId}</span>},
						{label: t("cheque.register.dueDate"), value: <span dir="ltr">{parsedDue}</span>},
						{label: t("cheque.pichak.amount"), value: <strong>{money(amountValue)}</strong>},
						...(reason ? [{label: t("cheque.register.reason"), value: reason.name}] : []),
						...receivers.map((row, index) => ({label: t("cheque.register.recipient", {number: index + 1}), value: `${row.name} (${row.idCode})`})),
						...guarantors.map((row, index) => ({label: t("cheque.issue.guarantor", {number: index + 1}), value: `${row.name} (${row.idCode})`})),
					]}
					confirmLabel={approval ? t("cheque.issue.issue") : t("cheque.issue.sign")}
					pendingLabel={approval ? t("cheque.issue.issuing") : t("cheque.issue.signing")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={asking.isPending || sending.pending}
					error={sending.refusal ?? signProblem}
					onConfirm={() => {
						if (approval) sending.submit()
						else {
							setSignProblem(null)
							asking.mutate()
						}
					}}
				>
					{approval ? (
						<p role="status" className="rounded-md border bg-muted p-3 text-sm">
							{t("cheque.issue.hamoonSent")}
						</p>
					) : null}
					<AccountPassword requirement={requirement} accountNumber={account.number} codeServiceName={SERVICE} amount={amountValue} value={password} onChange={setPassword} disabled={asking.isPending || sending.pending || approval !== null} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}
