import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {requestChequeBook} from "@/features/cheque/api/cheque-book"
import {chequeBookTypesOptions} from "@/features/cheque/api/cheque.queries"
import {branchesOptions} from "@/features/transaction/api/branch.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {BranchSelect} from "@/features/transaction/components/branch-select"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"

// The bank's names for this service: which accounts may ask, and the SMS code.
const SERVICE = "RequestChequeBook"
const TERMS_URL = "/files/ChequeBookIssuanceTermsAndConditions.pdf"

type Errors = Partial<Record<"account" | "type" | "branch", string>>

/** Ask for a new cheque book for a current account, to be collected at the branch of your choice. */
export default function ChequeBookPage() {
	const {t, i18n} = useTranslation()
	const types = useQuery(chequeBookTypesOptions())
	const branches = useQuery(branchesOptions(i18n.language))

	const [account, setAccount] = useState<SourceAccount | null>(null)
	const [typeKey, setTypeKey] = useState("")
	const [branchCode, setBranchCode] = useState("")
	// The terms must be opened before they can be accepted, as in the old bank.
	const [openedTerms, setOpenedTerms] = useState(false)
	const [accepted, setAccepted] = useState(false)
	const [errors, setErrors] = useState<Errors>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const bookType = types.data?.find((type) => String(type.key) === typeKey)
	const branchName = branches.data?.find((branch) => branch.code === branchCode)?.name ?? branchCode
	const requirement = usePasswordRequirement({accountId: confirming ? (account?.id ?? null) : null, limitServiceName: SERVICE, amount: 0})

	const sending = useSubmitTransaction({
		run: () => {
			if (!account || !bookType || requirement.state !== "ready") throw new Error("form incomplete")
			return requestChequeBook({accountNumber: account.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, bookType: bookType.key, branchCode})
		},
		again: {to: routeMap.chequeBook.path, label: t("cheque.book.again")},
		failedText: t("cheque.book.failed"),
		uncertainText: t("cheque.book.uncertain"),
	})

	const review = (): void => {
		const found: Errors = {}
		if (!account) found.account = t("cheque.book.error.account")
		if (!bookType) found.type = t("cheque.book.error.type")
		if (branchCode === "") found.branch = t("cheque.book.error.branch")
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
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.book.title")}</h1>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					review()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="cb-account">{t("cheque.account")}</Label>
					<SourceAccountSelect
						id="cb-account"
						serviceName={SERVICE}
						value={account?.id ?? null}
						onChange={(next) => {
							setAccount(next)
							setErrors({})
						}}
						invalid={errors.account !== undefined}
					/>
					{error(errors.account)}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="cb-type">{t("cheque.book.type")}</Label>
					{types.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : types.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("cheque.book.typesError")}
						</p>
					) : (
						<Select
							value={typeKey}
							onValueChange={(value) => {
								setTypeKey(value)
								setErrors({})
							}}
						>
							<SelectTrigger id="cb-type" className="w-full" aria-invalid={errors.type !== undefined}>
								<SelectValue placeholder={t("cheque.book.chooseType")} />
							</SelectTrigger>
							<SelectContent>
								{types.data.map((type) => (
									<SelectItem key={type.key} value={String(type.key)}>
										{type.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{error(errors.type)}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="cb-branch">{t("cheque.book.branch")}</Label>
					<BranchSelect
						id="cb-branch"
						value={branchCode}
						onChange={(code) => {
							setBranchCode(code)
							setErrors({})
						}}
						invalid={errors.branch !== undefined}
					/>
					{error(errors.branch)}
				</div>

				<div className="flex items-start gap-2">
					<Checkbox id="cb-terms" checked={accepted} disabled={!openedTerms} onCheckedChange={(on) => setAccepted(on === true)} />
					<Label htmlFor="cb-terms" className="font-normal leading-6">
						{t("cheque.book.accept")}{" "}
						<a href={TERMS_URL} target="_blank" rel="noreferrer" className="font-medium text-brand underline" onClick={() => setOpenedTerms(true)}>
							{t("cheque.book.terms")}
						</a>
					</Label>
				</div>
				{!openedTerms ? <p className="text-xs text-muted-foreground">{t("cheque.book.openTerms")}</p> : null}

				<div>
					<Button type="submit" disabled={!accepted}>
						{t("cheque.book.review")}
					</Button>
				</div>
			</form>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setPassword("")
						setConfirming(false)
					}}
					title={t("cheque.book.confirmTitle")}
					description={t("cheque.book.confirmQuestion")}
					summary={[
						{label: t("cheque.account"), value: <span dir="ltr">{account?.number}</span>},
						{label: t("cheque.book.type"), value: bookType?.title ?? ""},
						{label: t("cheque.book.branch"), value: branchName},
					]}
					confirmLabel={t("cheque.book.confirm")}
					pendingLabel={t("cheque.book.sending")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword requirement={requirement} accountNumber={account?.number ?? ""} codeServiceName={SERVICE} amount={0} value={password} onChange={setPassword} disabled={sending.pending} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}
