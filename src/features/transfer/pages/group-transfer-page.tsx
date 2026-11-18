import {Loader2, Plus, Search, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {getAccountOwner, transferGroup, type AccountOwner} from "@/features/transfer/api/transfer"
import {SourceAccountCards} from "@/features/transaction/components/source-account-cards"
import {FieldError, HolderCard, StepSection, FlowLayout, FlowSummary} from "@/components/flow/flow-form"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for a group transfer: which accounts may pay, the limit and the SMS code.
const SERVICE = "BatchTransferMoney"
const ACCOUNT_PATTERN = /^\d{5,15}$/
// A sensible ceiling for the form; the bank enforces its own (smaller or larger) limit and says so.
const MAX_ROWS = 50

interface Row {
	key: number
	destination: string
	amount: string
	description: string
	owner: AccountOwner | null
	checking: boolean
	problem: string | null
}

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")
const newRow = (key: number): Row => ({key, destination: "", amount: "", description: "", owner: null, checking: false, problem: null})

/** Pay several Maskan accounts from one account in a single batch. */
export default function GroupTransferPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [rows, setRows] = useState<Row[]>(() => [newRow(1)])
	const [nextKey, setNextKey] = useState(2)
	const [note, setNote] = useState("")
	const [sourceError, setSourceError] = useState<string | null>(null)
	const [listError, setListError] = useState<string | null>(null)
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const total = rows.reduce((sum, row) => sum + (row.amount === "" ? 0 : Number(row.amount)), 0)
	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: SERVICE, amount: total})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("transfer.rial")}`

	const update = (key: number, change: Partial<Row>): void => setRows((current) => current.map((row) => (row.key === key ? {...row, ...change} : row)))

	const check = async (row: Row): Promise<void> => {
		if (!ACCOUNT_PATTERN.test(row.destination)) {
			update(row.key, {problem: t("transfer.error.destinationFormat")})
			return
		}
		update(row.key, {checking: true, problem: null, owner: null})
		try {
			const owner = await getAccountOwner(row.destination)
			// Ignore the answer when the number was edited meanwhile.
			setRows((current) => current.map((candidate) => (candidate.key === row.key && candidate.destination === row.destination ? {...candidate, owner, checking: false} : candidate)))
		} catch (error) {
			const message = error instanceof Error && error.message ? error.message : t("transfer.lookupFailed")
			setRows((current) => current.map((candidate) => (candidate.key === row.key ? {...candidate, checking: false, problem: message} : candidate)))
		}
	}

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || requirement.state !== "ready") throw new Error("form incomplete")
			return transferGroup({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				items: rows.map((row) => ({destinationAccountNumber: row.destination, amount: Number(row.amount), description: row.description.trim()})),
				documentDescription: note.trim(),
			})
		},
		again: {to: routeMap.transferGroup.path, label: t("transfer.group.again")},
		failedText: t("transfer.failed"),
		uncertainText: t("transfer.uncertain"),
	})

	const review = (): void => {
		let valid = true
		setSourceError(null)
		setListError(null)
		if (!source) {
			setSourceError(t("transfer.error.source"))
			valid = false
		}
		const seen = new Set<string>()
		const checked = rows.map((row) => {
			let problem: string | null = null
			if (!row.owner || row.owner.number !== row.destination) problem = ACCOUNT_PATTERN.test(row.destination) ? t("transfer.error.notChecked") : t("transfer.error.destinationFormat")
			else if (source && source.number === row.destination) problem = t("transfer.error.sameAccount")
			else if (seen.has(row.destination)) problem = t("transfer.group.error.duplicate")
			else if (row.amount === "" || Number(row.amount) <= 0) problem = t("transfer.error.amount")
			seen.add(row.destination)
			if (problem) valid = false
			return problem === row.problem ? row : {...row, problem}
		})
		setRows(checked)
		if (!valid) {
			setListError(t("transfer.group.error.fix"))
			return
		}
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<>
			<FlowLayout
				title={t("transfer.group.title")}
				aside={
					<FlowSummary
						id="gt-summary"
						title={t("transfer.summary")}
						amount={total > 0 ? money(total) : null}
						rows={[
							{label: t("transfer.sourceAccount"), value: source ? source.name || source.type : null},
							{label: t("transfer.group.recipients"), value: formatAmount(rows.length, language)},
						]}
						reviewLabel={t("transfer.review")}
						onReview={review}
					/>
				}
			>
				<StepSection id="gt-from" step={1} title={t("transfer.from")}>
					<p id="gt-source-label" className="sr-only">
						{t("transfer.sourceAccount")}
					</p>
					<SourceAccountCards
						serviceName={SERVICE}
						value={source?.id ?? null}
						labelledBy="gt-source-label"
						onChange={(account) => {
							setSource(account)
							setSourceError(null)
						}}
					/>
					{sourceError ? <FieldError>{sourceError}</FieldError> : null}
				</StepSection>

				<StepSection id="gt-to" step={2} title={t("transfer.group.recipients")}>
					<ul className="flex flex-col gap-4">
						{rows.map((row, index) => (
							<li key={row.key} className="flex flex-col gap-3 rounded-xl border p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium text-muted-foreground">{t("transfer.group.recipient", {number: index + 1})}</span>
									{rows.length > 1 ? (
										<Button type="button" variant="ghost" size="icon" aria-label={t("transfer.group.remove", {number: index + 1})} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}>
											<Trash2 aria-hidden="true" />
										</Button>
									) : null}
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor={`gt-dest-${row.key}`}>{t("transfer.destinationAccount")}</Label>
									<div className="flex items-center gap-2">
										<Input
											id={`gt-dest-${row.key}`}
											dir="ltr"
											inputMode="numeric"
											autoComplete="off"
											maxLength={15}
											className="h-11 text-base"
											value={row.destination}
											aria-invalid={row.problem !== null}
											aria-describedby={row.problem !== null ? `gt-dest-${row.key}-error` : undefined}
											onChange={(event) => update(row.key, {destination: digits(event.target.value), owner: null, problem: null})}
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													event.preventDefault()
													void check(row)
												}
											}}
										/>
										<Button type="button" variant="outline" className="h-11" disabled={row.checking || row.destination === ""} onClick={() => void check(row)}>
											{row.checking ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
											{row.checking ? t("transfer.checking") : t("transfer.check")}
										</Button>
									</div>
									{row.owner ? <HolderCard label={t("transfer.holderLabel")} name={row.owner.name || row.owner.number} /> : null}
									{row.problem ? <FieldError id={`gt-dest-${row.key}-error`}>{row.problem}</FieldError> : null}
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="flex flex-col gap-2">
										<Label htmlFor={`gt-amount-${row.key}`}>{t("transfer.amount")}</Label>
										<Input
											id={`gt-amount-${row.key}`}
											dir="ltr"
											inputMode="numeric"
											autoComplete="off"
											maxLength={15}
											className="h-11 text-base"
											value={row.amount}
											onChange={(event) => update(row.key, {amount: digits(event.target.value).replace(/^0+/, ""), problem: null})}
										/>
										{row.amount !== "" ? <p className="text-sm text-muted-foreground">{money(Number(row.amount))}</p> : null}
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor={`gt-desc-${row.key}`}>
											{t("transfer.description")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
										</Label>
										<Input id={`gt-desc-${row.key}`} className="h-11" value={row.description} onChange={(event) => update(row.key, {description: event.target.value})} />
									</div>
								</div>
							</li>
						))}
					</ul>
					<div>
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
							{t("transfer.group.add")}
						</Button>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="gt-note">
							{t("transfer.group.note")} <span className="font-normal text-muted-foreground">({t("transfer.optional")})</span>
						</Label>
						<Input id="gt-note" value={note} onChange={(event) => setNote(event.target.value)} />
					</div>
					<p className="text-sm font-semibold">{t("transfer.group.total", {amount: money(total)})}</p>
					{listError ? <FieldError>{listError}</FieldError> : null}
				</StepSection>
			</FlowLayout>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setPassword("")
						setConfirming(false)
					}}
					title={t("transfer.group.confirmTitle")}
					description={t("transfer.group.confirmQuestion", {count: rows.length})}
					summary={[
						{label: t("transfer.sourceAccount"), value: <span dir="ltr">{source?.number}</span>},
						...rows.map((row, index) => ({
							label: row.owner?.name || t("transfer.group.recipient", {number: index + 1}),
							value: (
								<span>
									<span dir="ltr">{row.destination}</span> · {money(Number(row.amount))}
								</span>
							),
						})),
						{label: t("transfer.group.totalLabel"), amount: true, value: money(total)},
						...(note.trim() !== "" ? [{label: t("transfer.group.note"), value: note.trim()}] : []),
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
						codeServiceName={SERVICE}
						amount={total}
						value={password}
						onChange={setPassword}
						disabled={sending.pending}
					/>
				</ConfirmDialog>
			) : null}
		</>
	)
}
