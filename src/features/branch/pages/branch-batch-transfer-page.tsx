import {useQuery} from "@tanstack/react-query"
import {Plus, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {intraBatchTransfer, type IntraTransferKind} from "@/features/branch/api/intra"
import {SignedPdfUpload, type SignedPdf} from "@/features/branch/components/signed-pdf-upload"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {getAccountOwner, getIbanHolder} from "@/features/transfer/api/transfer"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {isValidIban} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for the in-branch batch transfer: which accounts may do it, the limit and the SMS code.
const SERVICE = "IntraBatchTransfer"
const KINDS: IntraTransferKind[] = ["internal", "satna", "paya"]
const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

interface Row {
	key: number
	destination: string
	firstName: string
	lastName: string
	amount: string
	paymentId: string
	description: string
	/** The holder was found, so the names above are the bank's. */
	found: boolean
	/** The bank could not look the holder up; the names are typed. */
	typed: boolean
	checking: boolean
	problem: string | null
}

const newRow = (key: number): Row => ({key, destination: "", firstName: "", lastName: "", amount: "", paymentId: "", description: "", found: false, typed: false, checking: false, problem: null})

/** Several transfers at once through the branch: list who is paid and how much, then sign and upload one PDF for the batch. */
export default function BranchBatchTransferPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const reasons = useQuery(reasonCodesOptions(language))
	const [kind, setKind] = useState<IntraTransferKind>("internal")
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [rows, setRows] = useState<Row[]>(() => [newRow(1)])
	const [reasonCode, setReasonCode] = useState("")
	const [note, setNote] = useState("")
	const [document, setDocument] = useState<SignedPdf | null>(null)
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const iban = kind !== "internal"
	const total = rows.reduce((sum, row) => sum + (row.amount === "" ? 0 : Number(row.amount)), 0)
	const reason = reasons.data?.find((item) => item.code === reasonCode)
	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: SERVICE, amount: total})
	const money = (number: number): string => `${formatAmount(number, language)} ${t("transfer.rial")}`

	const patch = (key: number, change: Partial<Row>): void => setRows((current) => current.map((row) => (row.key === key ? {...row, ...change} : row)))

	const lookUp = async (row: Row): Promise<void> => {
		if (iban && !isValidIban(row.destination)) return patch(row.key, {problem: t("transfer.iban.error.format")})
		patch(row.key, {checking: true, problem: null})
		try {
			if (kind === "internal") {
				const owner = await getAccountOwner(row.destination)
				patch(row.key, {checking: false, found: true, typed: false, firstName: owner.firstName, lastName: owner.lastName})
			} else {
				const holder = await getIbanHolder(row.destination, kind)
				patch(row.key, holder.withoutInquiry ? {checking: false, found: true, typed: true, firstName: "", lastName: ""} : {checking: false, found: true, typed: false, firstName: holder.firstName, lastName: holder.lastName})
			}
		} catch (error) {
			patch(row.key, {checking: false, found: false, problem: error instanceof Error && error.message ? error.message : t("branch.transfer.error.lookup")})
		}
	}

	const changeKind = (next: IntraTransferKind): void => {
		setKind(next)
		setRows([newRow(1)])
		setProblem("")
	}

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || !document || requirement.state !== "ready") throw new Error("form incomplete")
			return intraBatchTransfer({
				kind,
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				items: rows.map((row) => ({destination: row.destination, destinationFirstName: row.firstName.trim(), destinationLastName: row.lastName.trim(), amount: Number(row.amount), paymentId: row.paymentId.trim(), description: row.description.trim(), reasonCode})),
				description: note.trim(),
				document: document.base64,
			})
		},
		again: {to: routeMap.branchBatchTransfer.path, label: t("branch.batch.again")},
		failedText: t("branch.batch.failed"),
		uncertainText: t("branch.batch.uncertain"),
	})

	const review = (): void => {
		if (!source) return setProblem(t("branch.transfer.error.source"))
		const seen = new Set<string>()
		let ok = true
		const checked = rows.map((row) => {
			let rowProblem: string | null = null
			if (!row.found) rowProblem = t("branch.batch.error.notFound")
			else if (row.typed && (row.firstName.trim() === "" || row.lastName.trim() === "")) rowProblem = t("transfer.iban.error.name")
			else if (row.amount === "" || Number(row.amount) <= 0) rowProblem = t("branch.transfer.error.amount")
			else if (row.description.trim() === "") rowProblem = t("branch.transfer.error.description")
			else if (seen.has(`${row.destination}-${row.amount}`)) rowProblem = t("branch.batch.error.duplicate")
			seen.add(`${row.destination}-${row.amount}`)
			if (rowProblem) ok = false
			return rowProblem === row.problem ? row : {...row, problem: rowProblem}
		})
		setRows(checked)
		if (!ok) return setProblem(t("branch.batch.error.fixRows"))
		if ((reasons.data?.length ?? 0) > 0 && !reason) return setProblem(t("branch.transfer.error.reason"))
		if (!document) return setProblem(t("branch.error.document"))
		setProblem("")
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	const templateHref = kind === "internal" ? "/files/Transaction-Document-Internal%20Transfer.docx" : "/files/Transaction-Document-Satna-Paya.docx"

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("branch.batch.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("branch.batch.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-wrap gap-4" role="radiogroup" aria-label={t("branch.transfer.kind")}>
					{KINDS.map((item) => (
						<label key={item} className="flex items-center gap-2 text-sm">
							<input type="radio" name="bb-kind" className="accent-primary" checked={kind === item} onChange={() => changeKind(item)} />
							{t(`branch.transfer.kinds.${item}`)}
						</label>
					))}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bb-source">{t("branch.transfer.source")}</Label>
					<SourceAccountSelect id="bb-source" serviceName={SERVICE} value={source?.id ?? null} onChange={setSource} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bb-reason">{t("branch.transfer.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : (
						<Select value={reasonCode} onValueChange={setReasonCode}>
							<SelectTrigger id="bb-reason" className="w-full">
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
				<div className="flex flex-col gap-2">
					<Label htmlFor="bb-note">
						{t("branch.batch.note")} <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span>
					</Label>
					<Input id="bb-note" maxLength={250} value={note} onChange={(event) => setNote(event.target.value)} />
				</div>
			</section>

			<section className="flex flex-col gap-3" aria-labelledby="bb-rows">
				<h2 id="bb-rows" className="text-base font-semibold">
					{t("branch.batch.rows")}
				</h2>
				<ul className="flex flex-col gap-3">
					{rows.map((row, index) => (
						<li key={row.key} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-muted-foreground">{t("branch.batch.row", {number: index + 1})}</span>
								{rows.length > 1 ? (
									<Button type="button" variant="ghost" size="icon" aria-label={t("branch.batch.remove", {number: index + 1})} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
										<Trash2 aria-hidden="true" />
									</Button>
								) : null}
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{iban ? <span dir="ltr" className="text-sm text-muted-foreground">IR</span> : null}
								<Input dir="ltr" inputMode="numeric" autoComplete="off" maxLength={iban ? 24 : 20} className="max-w-72" aria-label={iban ? t("branch.transfer.destinationIban") : t("branch.transfer.destinationAccount")} value={row.destination} onChange={(event) => patch(row.key, {destination: digits(event.target.value), found: false, typed: false, problem: null})} />
								<Button type="button" variant="outline" disabled={row.checking || row.destination === ""} onClick={() => void lookUp(row)}>
									{row.checking ? t("branch.transfer.looking") : t("branch.transfer.lookUp")}
								</Button>
							</div>
							{row.found && !row.typed ? (
								<p className="text-sm font-medium text-success">{t("transfer.holder", {name: `${row.firstName} ${row.lastName}`.trim()})}</p>
							) : null}
							{row.typed ? (
								<div className="grid gap-3 sm:grid-cols-2">
									<Input maxLength={50} aria-label={t("branch.transfer.firstName")} placeholder={t("branch.transfer.firstName")} value={row.firstName} onChange={(event) => patch(row.key, {firstName: event.target.value})} />
									<Input maxLength={50} aria-label={t("branch.transfer.lastName")} placeholder={t("branch.transfer.lastName")} value={row.lastName} onChange={(event) => patch(row.key, {lastName: event.target.value})} />
								</div>
							) : null}
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="flex flex-col gap-1">
									<Input dir="ltr" inputMode="numeric" autoComplete="off" maxLength={16} aria-label={t("branch.transfer.amount")} placeholder={t("branch.transfer.amount")} value={row.amount} onChange={(event) => patch(row.key, {amount: digits(event.target.value).replace(/^0+/, "")})} />
									{row.amount !== "" ? <span className="text-xs text-muted-foreground">{money(Number(row.amount))}</span> : null}
								</div>
								{iban ? <Input dir="ltr" inputMode="numeric" autoComplete="off" maxLength={30} aria-label={t("branch.transfer.paymentId")} placeholder={t("branch.transfer.paymentId")} value={row.paymentId} onChange={(event) => patch(row.key, {paymentId: digits(event.target.value)})} /> : null}
								<Input maxLength={250} aria-label={t("branch.transfer.description")} placeholder={t("branch.transfer.description")} value={row.description} onChange={(event) => patch(row.key, {description: event.target.value})} />
							</div>
							{row.problem ? (
								<p role="alert" className="text-sm text-destructive">
									{row.problem}
								</p>
							) : null}
						</li>
					))}
				</ul>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, newRow(Math.max(0, ...current.map((row) => row.key)) + 1)])}>
						<Plus aria-hidden="true" />
						{t("branch.batch.add")}
					</Button>
					<p className="text-sm font-medium">{t("branch.batch.total", {amount: money(total)})}</p>
				</div>
			</section>

			<SignedPdfUpload value={document} onChange={setDocument} accountNumber={source?.number ?? null} templateHref={templateHref} invalid={problem !== "" && !document} />

			{problem ? (
				<p role="alert" className="text-sm text-destructive">
					{problem}
				</p>
			) : null}
			<div className="flex gap-2">
				<Button type="button" onClick={review}>
					{t("branch.review")}
				</Button>
				<Button asChild variant="outline">
					<Link to={routeMap.branch.path}>{t("branch.menu.back")}</Link>
				</Button>
			</div>

			{confirming && source && document ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setPassword("")
						setConfirming(false)
					}}
					title={t("branch.batch.confirmTitle")}
					description={t("branch.batch.confirmQuestion", {count: rows.length})}
					summary={[
						{label: t("branch.transfer.source"), value: <span dir="ltr">{source.number}</span>},
						{label: t("branch.batch.count"), value: String(rows.length)},
						{label: t("branch.batch.totalLabel"), value: <strong>{money(total)}</strong>},
						{label: t("branch.upload.file"), value: <span dir="ltr">{document.name}</span>},
					]}
					confirmLabel={t("branch.transfer.confirm")}
					pendingLabel={t("branch.sending")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword requirement={requirement} accountNumber={source.number} codeServiceName={SERVICE} amount={total} value={password} onChange={setPassword} disabled={sending.pending} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}
