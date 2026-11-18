import {OtherLoanTabs} from "@/features/loan/components/other-loan-tabs"
import {useQuery} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight, Plus, Trash2} from "lucide-react"
import {useRef, useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {importBatchLoans, isLoanNumber, lookupLoan, payBatchLoan} from "@/features/loan/api/other-loan"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for paying installments from an account: which accounts may pay, the limit and the SMS code.
const SERVICE = "AccountInstallment"
// A sensible ceiling for the form; the bank enforces its own (smaller or larger) limit and says so.
const MAX_ROWS = 50

interface Row {
	key: number
	number: string
	amount: string
	reasonCode: string
	/** Who the loan belongs to, once looked up. */
	holder: string | null
	/** The number the lookup was made for. */
	checked: string | null
	checking: boolean
	problem: string | null
}

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")
const newRow = (key: number): Row => ({key, number: "", amount: "", reasonCode: "", holder: null, checked: null, checking: false, problem: null})

/** Pay installments of several loans (yours or others') from one account in a single batch. */
export default function BatchLoanPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const reasons = useQuery(reasonCodesOptions(language))
	const needsReason = (reasons.data?.length ?? 0) > 0
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [rows, setRows] = useState<Row[]>(() => [newRow(1)])
	const [nextKey, setNextKey] = useState(2)
	const [note, setNote] = useState("")
	const [follow, setFollow] = useState(false)
	const [sourceError, setSourceError] = useState<string | null>(null)
	const [listError, setListError] = useState<string | null>(null)
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")
	const fileInput = useRef<HTMLInputElement>(null)
	const [importing, setImporting] = useState(false)
	const [importError, setImportError] = useState<string | null>(null)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	const total = rows.reduce((sum, row) => sum + (row.amount === "" ? 0 : Number(row.amount)), 0)
	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: SERVICE, amount: total})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("loan.rial")}`
	const reasonName = (code: string): string => reasons.data?.find((reason) => reason.code === code)?.name ?? code

	const update = (key: number, change: Partial<Row>): void => setRows((current) => current.map((row) => (row.key === key ? {...row, ...change} : row)))

	const check = async (row: Row): Promise<void> => {
		if (!isLoanNumber(row.number)) {
			update(row.key, {problem: t("loan.other.error.number")})
			return
		}
		update(row.key, {checking: true, problem: null, holder: null, checked: null})
		try {
			const loan = await lookupLoan(row.number)
			// Ignore the answer when the number was edited meanwhile.
			setRows((current) =>
				current.map((candidate) =>
					candidate.key === row.key && candidate.number === row.number
						? {...candidate, holder: loan.holder || row.number, checked: row.number, checking: false, amount: candidate.amount === "" && loan.installment ? String(loan.installment) : candidate.amount}
						: candidate,
				),
			)
		} catch (error) {
			const message = error instanceof Error && error.message ? error.message : t("loan.other.failed")
			setRows((current) => current.map((candidate) => (candidate.key === row.key ? {...candidate, checking: false, problem: message} : candidate)))
		}
	}

	// Reads the bank's Excel template into rows, then checks each loan number one after another.
	const importFile = async (file: File): Promise<void> => {
		setImporting(true)
		setImportError(null)
		try {
			const imported = await importBatchLoans(file)
			if (imported.length === 0) {
				setImportError(t("loan.batch.importEmpty"))
				return
			}
			const known = new Set((reasons.data ?? []).map((reason) => reason.code))
			let key = nextKey
			const added: Row[] = imported.map((item) => ({...newRow(key++), number: item.number, amount: item.amount.replace(/^0+/, ""), reasonCode: known.has(item.reasonCode) ? item.reasonCode : ""}))
			const keep = rows.filter((row) => row.number !== "" || row.amount !== "")
			if (keep.length + added.length > MAX_ROWS) {
				setImportError(t("loan.batch.importTooMany", {count: MAX_ROWS}))
				return
			}
			setNextKey(key)
			setRows([...keep, ...added])
			for (const row of added) await check(row)
		} catch (error) {
			setImportError(error instanceof Error && error.message ? error.message : t("loan.batch.importFailed"))
		} finally {
			setImporting(false)
		}
	}

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || requirement.state !== "ready") throw new Error("form incomplete")
			return payBatchLoan({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				items: rows.map((row) => ({number: row.number, amount: Number(row.amount), holder: row.holder ?? "", reasonCode: row.reasonCode})),
				documentDescription: note.trim(),
				follow,
			})
		},
		again: {to: routeMap.loanBatch.path, label: t("loan.batch.again")},
		failedText: t("loan.pay.failed"),
		uncertainText: t("loan.pay.uncertain"),
	})

	const review = (): void => {
		let valid = true
		setSourceError(null)
		setListError(null)
		if (!source) {
			setSourceError(t("loan.batch.error.account"))
			valid = false
		}
		const seen = new Set<string>()
		const checked = rows.map((row) => {
			let problem: string | null = null
			if (row.checked !== row.number) problem = isLoanNumber(row.number) ? t("loan.batch.error.notChecked") : t("loan.other.error.number")
			else if (seen.has(row.number)) problem = t("loan.batch.error.duplicate")
			else if (row.amount === "" || Number(row.amount) <= 0) problem = t("loan.batch.error.amount")
			else if (needsReason && row.reasonCode === "") problem = t("loan.batch.error.reason")
			seen.add(row.number)
			if (problem) valid = false
			return problem === row.problem ? row : {...row, problem}
		})
		setRows(checked)
		if (!valid) {
			setListError(t("loan.batch.error.fix"))
			return
		}
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("loan.batch.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.loan.path}>
						<BackIcon aria-hidden="true" />
						{t("loan.interest.back")}
					</Link>
				</Button>
			</div>
			<OtherLoanTabs />
			<p className="text-sm text-muted-foreground">{t("loan.batch.hint")}</p>

			<section aria-labelledby="bl-from" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="bl-from" className="text-base font-semibold">
					{t("loan.pay.from")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bl-source">{t("loan.pay.from")}</Label>
					<SourceAccountSelect
						id="bl-source"
						serviceName={SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							setSourceError(null)
						}}
						invalid={sourceError !== null}
					/>
					{sourceError ? (
						<p role="alert" className="text-sm text-destructive">
							{sourceError}
						</p>
					) : null}
				</div>
			</section>

			<section aria-labelledby="bl-loans" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<h2 id="bl-loans" className="text-base font-semibold">
					{t("loan.batch.loans")}
				</h2>
				<ul className="flex flex-col gap-4">
					{rows.map((row, index) => (
						<li key={row.key} className="flex flex-col gap-3 rounded-md border p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-muted-foreground">{t("loan.batch.loan", {number: index + 1})}</span>
								{rows.length > 1 ? (
									<Button type="button" variant="ghost" size="icon" aria-label={t("loan.batch.remove", {number: index + 1})} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}>
										<Trash2 aria-hidden="true" />
									</Button>
								) : null}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor={`bl-number-${row.key}`}>{t("loan.other.number")}</Label>
								<div className="flex items-center gap-2">
									<Input
										id={`bl-number-${row.key}`}
										dir="ltr"
										inputMode="numeric"
										autoComplete="off"
										maxLength={22}
										value={row.number}
										aria-invalid={row.problem !== null}
										onChange={(event) => update(row.key, {number: digits(event.target.value), holder: null, checked: null, problem: null})}
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												event.preventDefault()
												void check(row)
											}
										}}
									/>
									<Button type="button" variant="outline" disabled={row.checking || row.number === ""} onClick={() => void check(row)}>
										{row.checking ? t("loan.other.looking") : t("loan.batch.check")}
									</Button>
								</div>
								{row.holder ? (
									<p role="status" className="text-sm font-medium text-success">
										{t("loan.batch.holder", {name: row.holder})}
									</p>
								) : null}
								{row.problem ? (
									<p role="alert" className="text-sm text-destructive">
										{row.problem}
									</p>
								) : null}
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="flex flex-col gap-2">
									<Label htmlFor={`bl-amount-${row.key}`}>{t("loan.pay.amount")}</Label>
									<Input id={`bl-amount-${row.key}`} dir="ltr" inputMode="numeric" autoComplete="off" maxLength={15} value={row.amount} onChange={(event) => update(row.key, {amount: digits(event.target.value).replace(/^0+/, ""), problem: null})} />
									{row.amount !== "" ? <p className="text-sm text-muted-foreground">{money(Number(row.amount))}</p> : null}
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor={`bl-reason-${row.key}`}>{t("loan.pay.reason")}</Label>
									<Select value={row.reasonCode} onValueChange={(value) => update(row.key, {reasonCode: value, problem: null})}>
										<SelectTrigger id={`bl-reason-${row.key}`} className="w-full">
											<SelectValue placeholder={t("loan.pay.chooseReason")} />
										</SelectTrigger>
										<SelectContent>
											{(reasons.data ?? []).map((reason) => (
												<SelectItem key={reason.code} value={reason.code}>
													{reason.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</li>
					))}
				</ul>
				<div className="flex flex-wrap items-center gap-2">
					<input
						ref={fileInput}
						type="file"
						accept=".xlsx,.xls"
						className="sr-only"
						aria-label={t("loan.batch.import")}
						onChange={(event) => {
							const file = event.target.files?.[0]
							event.target.value = ""
							if (file) void importFile(file)
						}}
					/>
					<Button type="button" variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
						{importing ? t("loan.batch.importing") : t("loan.batch.import")}
					</Button>
					<a className="text-sm underline underline-offset-4" href={language === "fa" ? "/files/BatchLoanSampleFa.xlsx" : "/files/BatchLoanSampleEn.xlsx"} download>
						{t("loan.batch.sample")}
					</a>
					<Button
						type="button"
						variant="outline"
						disabled={rows.length >= MAX_ROWS}
						onClick={() => {
							setRows((current) => [...current, newRow(nextKey)])
							setNextKey((key) => key + 1)
						}}
					>
						<Plus aria-hidden="true" />
						{t("loan.batch.add")}
					</Button>
				</div>
				{importError ? (
					<p role="alert" className="text-sm text-destructive">
						{importError}
					</p>
				) : null}
				<div className="flex flex-col gap-2">
					<Label htmlFor="bl-note">
						{t("loan.batch.note")} <span className="font-normal text-muted-foreground">({t("loan.batch.optional")})</span>
					</Label>
					<Input id="bl-note" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
				</div>
				<div className="flex items-center gap-2">
					<Checkbox id="bl-follow" checked={follow} onCheckedChange={(checked) => setFollow(checked === true)} />
					<Label htmlFor="bl-follow">{t("loan.batch.follow")}</Label>
				</div>
				<p className="text-sm font-semibold">{t("loan.batch.total", {amount: money(total)})}</p>
			</section>

			{listError ? (
				<p role="alert" className="text-sm text-destructive">
					{listError}
				</p>
			) : null}
			<div>
				<Button type="button" onClick={review}>
					{t("loan.batch.review")}
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
					title={t("loan.batch.confirmTitle")}
					description={t("loan.batch.confirmQuestion", {count: rows.length})}
					summary={[
						{label: t("loan.pay.from"), value: <span dir="ltr">{source?.number}</span>},
						...rows.map((row, index) => ({
							label: row.holder || t("loan.batch.loan", {number: index + 1}),
							value: (
								<span>
									<span dir="ltr">{row.number}</span> · {money(Number(row.amount))}
									{row.reasonCode ? ` · ${reasonName(row.reasonCode)}` : ""}
								</span>
							),
						})),
						{label: t("loan.batch.totalLabel"), amount: true, value: money(total)},
						...(note.trim() !== "" ? [{label: t("loan.batch.note"), value: note.trim()}] : []),
					]}
					confirmLabel={t("loan.pay.confirm")}
					pendingLabel={t("loan.pay.sending")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword requirement={requirement} accountNumber={source?.number ?? ""} codeServiceName={SERVICE} amount={total} value={password} onChange={setPassword} disabled={sending.pending} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}
