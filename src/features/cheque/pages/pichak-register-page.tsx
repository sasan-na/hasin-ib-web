import {useQuery} from "@tanstack/react-query"
import {Plus, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {Textarea} from "@/components/ui/textarea"
import {getRecipientName, registerCheque, type PersonType} from "@/features/cheque/api/pichak-register"
import {sourceAccountsOptions} from "@/features/transaction/api/transaction.queries"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {reasonCodesOptions} from "@/features/transfer/api/transfer.queries"
import {isValidIban} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {jalaliToIso, parseJalali, todayJalali} from "@/lib/jalali"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for registering a cheque: which accounts may do it, the limit and the SMS code.
const SERVICE = "PichakRegisterCheque"
const TYPES: PersonType[] = [1, 2, 3, 4]
// How long the id of each kind is: a national id has exactly 10 digits, a foreigner's 12, a company's 1 to 20.
const ID_LENGTH: Record<PersonType, {min: number; max: number}> = {1: {min: 10, max: 10}, 2: {min: 1, max: 20}, 3: {min: 12, max: 12}, 4: {min: 1, max: 20}}

interface Row {
	key: number
	idType: PersonType
	idCode: string
	/** Filled from the registry; empty until the lookup has answered for this id. */
	name: string
	checking: boolean
	problem: string | null
}

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")
const newRow = (key: number): Row => ({key, idType: 1, idCode: "", name: "", checking: false, problem: null})

/** Register a cheque of yours in the central registry: when it falls due, for how much, and who it is payable to. */
export default function PichakRegisterPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const [params] = useSearchParams()
	const accountId = Number(params.get("account"))
	const series = params.get("series") ?? ""
	const serial = params.get("serial") ?? ""
	const sayyadId = params.get("sayyad") ?? ""
	const known = Number.isInteger(accountId) && accountId > 0 && series !== "" && serial !== "" && sayyadId !== ""

	const accounts = useQuery({...sourceAccountsOptions(SERVICE, language), enabled: known})
	const reasons = useQuery(reasonCodesOptions(language))
	const account = accounts.data?.find((candidate) => candidate.id === accountId)

	const [dueDate, setDueDate] = useState("")
	const [amount, setAmount] = useState("")
	const [description, setDescription] = useState("")
	const [iban, setIban] = useState("")
	const [reasonCode, setReasonCode] = useState("")
	const [rows, setRows] = useState<Row[]>(() => [newRow(1)])
	const [nextKey, setNextKey] = useState(2)
	const [errors, setErrors] = useState<Partial<Record<"dueDate" | "amount" | "description" | "iban" | "reason" | "recipients", string>>>({})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const amountValue = amount === "" ? 0 : Number(amount)
	const reason = reasons.data?.find((candidate) => candidate.code === reasonCode)
	const parsedDue = parseJalali(dueDate)
	const dueIso = parsedDue ? jalaliToIso(parsedDue) : null
	const requirement = usePasswordRequirement({accountId: confirming ? (account?.id ?? null) : null, limitServiceName: SERVICE, amount: amountValue})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("cheque.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (!account || !dueIso || !parsedDue || requirement.state !== "ready") throw new Error("form incomplete")
			return registerCheque({
				sourceAccountNumber: account.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				series,
				serial,
				sayyadId,
				dueDateIso: dueIso,
				dueDateJalali: parsedDue,
				amount: amountValue,
				description: description.trim(),
				iban,
				reasonCode,
				recipients: rows.map((row) => ({name: row.name, idType: row.idType, idCode: row.idCode})),
			})
		},
		again: {to: routeMap.chequeList.path, label: t("cheque.block.backToList")},
		failedText: t("cheque.register.failed"),
		uncertainText: t("cheque.register.uncertain"),
	})

	const update = (key: number, change: Partial<Row>): void => setRows((current) => current.map((row) => (row.key === key ? {...row, ...change} : row)))

	const lookup = async (row: Row): Promise<void> => {
		const {min, max} = ID_LENGTH[row.idType]
		if (row.idCode.length < min || row.idCode.length > max) {
			update(row.key, {problem: t("cheque.register.error.idLength", {min, max})})
			return
		}
		update(row.key, {checking: true, problem: null, name: ""})
		try {
			const name = await getRecipientName({sayyadId, idType: row.idType, idCode: row.idCode})
			// Ignore the answer when the id was edited meanwhile.
			setRows((current) => current.map((candidate) => (candidate.key === row.key && candidate.idCode === row.idCode && candidate.idType === row.idType ? {...candidate, name, checking: false} : candidate)))
		} catch (error) {
			const message = error instanceof Error && error.message ? error.message : t("cheque.register.error.lookup")
			setRows((current) => current.map((candidate) => (candidate.key === row.key ? {...candidate, checking: false, problem: message} : candidate)))
		}
	}

	const review = (): void => {
		const found: typeof errors = {}
		if (!dueIso || !parsedDue) found.dueDate = t("cheque.register.error.date")
		else if (parsedDue <= todayJalali()) found.dueDate = t("cheque.register.error.future")
		if (amountValue <= 0) found.amount = t("cheque.register.error.amount")
		if (description.trim() === "") found.description = t("cheque.register.error.description")
		if (iban !== "" && !isValidIban(iban)) found.iban = t("cheque.register.error.iban")
		if ((reasons.data?.length ?? 0) > 0 && !reason) found.reason = t("cheque.register.error.reason")
		const seen = new Set<string>()
		let rowsOk = true
		const checked = rows.map((row) => {
			let problem: string | null = null
			if (row.name === "") problem = t("cheque.register.error.notChecked")
			else if (seen.has(`${row.idType}-${row.idCode}`)) problem = t("cheque.register.error.duplicate")
			seen.add(`${row.idType}-${row.idCode}`)
			if (problem) rowsOk = false
			return problem === row.problem ? row : {...row, problem}
		})
		setRows(checked)
		if (!rowsOk) found.recipients = t("cheque.register.error.fixRecipients")
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

	if (!known) {
		return (
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
				<h1 className="text-2xl font-bold">{t("cheque.register.title")}</h1>
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
			<h1 className="text-2xl font-bold">{t("cheque.register.title")}</h1>

			{accounts.isPending ? (
				<Skeleton className="h-16 w-full" />
			) : !account ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("cheque.register.noAccount")}
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
						<Label htmlFor="pr-due">{t("cheque.register.dueDate")}</Label>
						<Input id="pr-due" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="1405/01/01" value={dueDate} aria-invalid={errors.dueDate !== undefined} onChange={(event) => setDueDate(normalizeDigits(event.target.value))} />
						{error(errors.dueDate)}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="pr-amount">{t("cheque.pichak.amount")}</Label>
						<Input id="pr-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={16} value={amount} aria-invalid={errors.amount !== undefined} onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))} />
						{amount !== "" ? <p className="text-sm text-muted-foreground">{money(amountValue)}</p> : null}
						{error(errors.amount)}
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="pr-reason">{t("cheque.register.reason")}</Label>
					{reasons.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : (
						<Select value={reasonCode} onValueChange={setReasonCode}>
							<SelectTrigger id="pr-reason" className="w-full" aria-invalid={errors.reason !== undefined}>
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
					<Label htmlFor="pr-description">{t("cheque.pichak.description")}</Label>
					<Textarea id="pr-description" rows={3} maxLength={250} value={description} aria-invalid={errors.description !== undefined} onChange={(event) => setDescription(event.target.value)} />
					{error(errors.description)}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="pr-iban">
						{t("cheque.register.iban")} <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span>
					</Label>
					<div className="flex items-center gap-1" dir="ltr">
						<span className="text-sm text-muted-foreground">IR</span>
						<Input id="pr-iban" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={24} value={iban} aria-invalid={errors.iban !== undefined} onChange={(event) => setIban(digits(event.target.value))} />
					</div>
					{error(errors.iban)}
				</div>

				<section aria-labelledby="pr-recipients" className="flex flex-col gap-3">
					<h2 id="pr-recipients" className="text-base font-semibold">
						{t("cheque.pichak.receivers")}
					</h2>
					<ul className="flex flex-col gap-3">
						{rows.map((row, index) => (
							<li key={row.key} className="flex flex-col gap-3 rounded-md border p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium text-muted-foreground">{t("cheque.register.recipient", {number: index + 1})}</span>
									{rows.length > 1 ? (
										<Button type="button" variant="ghost" size="icon" aria-label={t("cheque.register.remove", {number: index + 1})} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}>
											<Trash2 aria-hidden="true" />
										</Button>
									) : null}
								</div>
								<div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
									<div className="flex flex-col gap-2">
										<Label htmlFor={`pr-type-${row.key}`}>{t("cheque.register.personType")}</Label>
										<Select value={String(row.idType)} onValueChange={(value) => update(row.key, {idType: Number(value) as PersonType, name: "", problem: null})}>
											<SelectTrigger id={`pr-type-${row.key}`} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{TYPES.map((type) => (
													<SelectItem key={type} value={String(type)}>
														{t(`cheque.pichak.customerTypeCodes.${type}`)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor={`pr-code-${row.key}`}>{t("cheque.register.idCode")}</Label>
										<Input
											id={`pr-code-${row.key}`}
											dir="ltr"
											inputMode="numeric"
											autoComplete="off"
											maxLength={ID_LENGTH[row.idType].max}
											value={row.idCode}
											aria-invalid={row.problem !== null}
											onChange={(event) => update(row.key, {idCode: digits(event.target.value), name: "", problem: null})}
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													event.preventDefault()
													void lookup(row)
												}
											}}
										/>
									</div>
									<Button type="button" variant="outline" disabled={row.checking || row.idCode === ""} onClick={() => void lookup(row)}>
										{row.checking ? t("cheque.register.checking") : t("cheque.register.check")}
									</Button>
								</div>
								{row.name ? (
									<p role="status" className="text-sm font-medium text-success">
										{t("cheque.register.registeredName", {name: row.name})}
									</p>
								) : null}
								{error(row.problem ?? undefined)}
							</li>
						))}
					</ul>
					<div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setRows((current) => [...current, newRow(nextKey)])
								setNextKey((key) => key + 1)
							}}
						>
							<Plus aria-hidden="true" />
							{t("cheque.register.addRecipient")}
						</Button>
					</div>
					{error(errors.recipients)}
				</section>

				<div className="flex justify-end gap-2">
					<Button asChild variant="outline">
						<Link to={routeMap.chequeList.path}>{t("cheque.register.cancel")}</Link>
					</Button>
					<Button type="submit" disabled={!account}>
						{t("cheque.register.review")}
					</Button>
				</div>
			</form>

			{confirming && account ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						setPassword("")
						setConfirming(false)
					}}
					title={t("cheque.register.confirmTitle")}
					description={t("cheque.register.confirmQuestion")}
					summary={[
						{label: t("cheque.account"), value: <span dir="ltr">{account.number}</span>},
						{label: t("cheque.serial"), value: <span dir="ltr">{`${series} / ${serial}`}</span>},
						{label: t("cheque.register.dueDate"), value: <span dir="ltr">{parsedDue}</span>},
						{label: t("cheque.pichak.amount"), value: <strong>{money(amountValue)}</strong>},
						...(reason ? [{label: t("cheque.register.reason"), value: reason.name}] : []),
						...rows.map((row, index) => ({label: t("cheque.register.recipient", {number: index + 1}), value: `${row.name} (${row.idCode})`})),
					]}
					confirmLabel={t("cheque.register.confirm")}
					pendingLabel={t("cheque.register.sending")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<AccountPassword requirement={requirement} accountNumber={account.number} codeServiceName={SERVICE} amount={amountValue} value={password} onChange={setPassword} disabled={sending.pending} />
				</ConfirmDialog>
			) : null}
		</div>
	)
}
