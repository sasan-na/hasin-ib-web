import {useMutation, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {connectCard, disconnectCards, getCardToConnect, importCreditRows, moveCredit, moveCreditInBulk, type CardToConnect, type ConnectedCard, type CreditRow} from "@/features/card/api/connected-card"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's name for moving credit on connected cards: which accounts may pay, the limit and the SMS code.
const SERVICE = "MultiAccountCardChargeCredit"

/** The account whose card list is on screen; it also pays, and its password (or code) is asked for. */
export interface Payer {
	id: number
	number: string
}

interface CreditProps {
	payer: Payer
	card: ConnectedCard
	discharge: boolean
	onClose: () => void
}

/** Puts credit on a connected card from its account, or takes it back. Mount it only while open. */
export function CreditDialog({payer, card, discharge, onClose}: CreditProps) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [amount, setAmount] = useState("")
	const [description, setDescription] = useState("")
	const [password, setPassword] = useState("")
	const value = amount === "" ? 0 : Number(amount)
	const requirement = usePasswordRequirement({accountId: payer.id, limitServiceName: SERVICE, amount: value})
	const money = (number: number): string => `${formatAmount(number, i18n.language)} ${t("card.connected.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (requirement.state !== "ready" || value <= 0) throw new Error("form incomplete")
			return moveCredit({accountNumber: payer.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, pan: card.number, amount: value, discharge, description: description.trim()})
		},
		again: {to: routeMap.cardConnected.path, label: t("card.connected.again")},
		failedText: t("card.connected.failed"),
		uncertainText: t("card.connected.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: ["card", "connected"]}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={discharge ? t("card.connected.dischargeTitle") : t("card.connected.chargeTitle")}
			description={discharge ? t("card.connected.dischargeQuestion") : t("card.connected.chargeQuestion")}
			summary={[
				{label: t("card.connected.account"), value: <span dir="ltr">{payer.number}</span>},
				{label: t("card.connected.card"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>},
				...(value > 0 ? [{label: t("card.connected.amount"), value: <strong>{money(value)}</strong>}] : []),
			]}
			confirmLabel={discharge ? t("card.connected.discharge") : t("card.connected.charge")}
			pendingLabel={t("card.connected.sending")}
			canConfirm={value > 0 && isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="cc-amount">{t("card.connected.amount")}</Label>
					<Input id="cc-amount" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={15} value={amount} disabled={sending.pending} onChange={(event) => setAmount(normalizeDigits(event.target.value).replace(/\D/g, "").replace(/^0+/, ""))} />
					{discharge ? <p className="text-xs text-muted-foreground">{t("card.connected.creditIs", {amount: money(card.credit)})}</p> : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="cc-desc">
						{t("card.connected.description")} <span className="font-normal text-muted-foreground">({t("card.connected.optional")})</span>
					</Label>
					<Input id="cc-desc" maxLength={100} value={description} disabled={sending.pending} onChange={(event) => setDescription(event.target.value)} />
				</div>
				<AccountPassword requirement={requirement} accountNumber={payer.number} codeServiceName={SERVICE} amount={value} value={password} onChange={setPassword} disabled={sending.pending} />
			</div>
		</ConfirmDialog>
	)
}

interface DisconnectProps {
	payer: Payer
	card: ConnectedCard
	onClose: () => void
}

/** Disconnects a card from its account. Mount it only while open. */
export function DisconnectDialog({payer, card, onClose}: DisconnectProps) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [password, setPassword] = useState("")
	const requirement = usePasswordRequirement({accountId: payer.id, limitServiceName: SERVICE, amount: 0})

	const sending = useSubmitTransaction({
		run: () => {
			if (requirement.state !== "ready") throw new Error("form incomplete")
			return disconnectCards({accountNumber: payer.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, cards: [card.number]})
		},
		again: {to: routeMap.cardConnected.path, label: t("card.connected.again")},
		failedText: t("card.connected.failed"),
		uncertainText: t("card.connected.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: ["card", "connected"]}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("card.connected.disconnectTitle")}
			description={t("card.connected.disconnectQuestion")}
			summary={[
				{label: t("card.connected.account"), value: <span dir="ltr">{payer.number}</span>},
				{label: t("card.connected.card"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>},
			]}
			confirmLabel={t("card.connected.disconnect")}
			pendingLabel={t("card.connected.sending")}
			destructive
			canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<AccountPassword requirement={requirement} accountNumber={payer.number} codeServiceName={SERVICE} amount={0} value={password} onChange={setPassword} disabled={sending.pending} />
		</ConfirmDialog>
	)
}

interface ConnectProps {
	payer: Payer
	onClose: () => void
}

/** Connects another card to the account: look the card up, then confirm with the account password. Mount it only while open. */
export function ConnectDialog({payer, onClose}: ConnectProps) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [number, setNumber] = useState("")
	const [password, setPassword] = useState("")
	const [problem, setProblem] = useState("")
	const lookup = useMutation({mutationFn: () => getCardToConnect(payer.number, number)})
	const card: CardToConnect | undefined = lookup.data?.number === number ? lookup.data : undefined
	const requirement = usePasswordRequirement({accountId: payer.id, limitServiceName: SERVICE, amount: 0})

	const sending = useSubmitTransaction({
		run: () => {
			if (!card || requirement.state !== "ready") throw new Error("form incomplete")
			return connectCard({accountNumber: payer.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, pan: card.number})
		},
		again: {to: routeMap.cardConnected.path, label: t("card.connected.again")},
		failedText: t("card.connected.failed"),
		uncertainText: t("card.connected.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: ["card", "connected"]}),
	})

	const check = (): void => {
		if (!/^\d{16}$/.test(number)) return setProblem(t("card.connected.errors.number"))
		setProblem("")
		lookup.mutate()
	}

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("card.connected.connectTitle")}
			description={t("card.connected.connectQuestion")}
			summary={[
				{label: t("card.connected.account"), value: <span dir="ltr">{payer.number}</span>},
				...(card ? [{label: t("card.connected.card"), value: <span dir="ltr">{formatCardNumber(card.number)}</span>}, ...(card.holder ? [{label: t("card.connected.holder"), value: card.holder}] : [])] : []),
			]}
			confirmLabel={t("card.connected.connect")}
			pendingLabel={t("card.connected.sending")}
			canConfirm={card !== undefined && isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="cn-number">{t("card.connected.card")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="cn-number"
							dir="ltr"
							inputMode="numeric"
							autoComplete="off"
							maxLength={16}
							value={number}
							disabled={sending.pending}
							onChange={(event) => {
								setNumber(normalizeDigits(event.target.value).replace(/\D/g, ""))
								lookup.reset()
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									check()
								}
							}}
						/>
						<Button type="button" variant="outline" disabled={lookup.isPending || number === ""} onClick={check}>
							{lookup.isPending ? t("card.connected.checking") : t("card.connected.check")}
						</Button>
					</div>
					{lookup.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{lookup.error.message || t("card.connected.lookupFailed")}
						</p>
					) : null}
					{problem ? (
						<p role="alert" className="text-sm text-destructive">
							{problem}
						</p>
					) : null}
				</div>
				{card ? <AccountPassword requirement={requirement} accountNumber={payer.number} codeServiceName={SERVICE} amount={0} value={password} onChange={setPassword} disabled={sending.pending} /> : null}
			</div>
		</ConfirmDialog>
	)
}

interface GroupProps {
	payer: Payer
	onClose: () => void
}

/** Moves credit for many connected cards from an Excel file: read the file, check the rows, then confirm with the account password. Mount it only while open. */
export function GroupCreditDialog({payer, onClose}: GroupProps) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [discharge, setDischarge] = useState(false)
	const [rows, setRows] = useState<CreditRow[]>([])
	const [password, setPassword] = useState("")
	const read = useMutation({
		mutationFn: (file: File) => importCreditRows(file, discharge),
		onSuccess: (imported) => setRows(imported),
	})
	const good = rows.filter((row) => row.problem === "" && /^\d{16}$/.test(row.pan) && row.amount > 0)
	const clean = rows.length > 0 && good.length === rows.length
	const total = good.reduce((sum, row) => sum + row.amount, 0)
	const requirement = usePasswordRequirement({accountId: payer.id, limitServiceName: SERVICE, amount: total})
	const money = (number: number): string => `${formatAmount(number, i18n.language)} ${t("card.connected.rial")}`

	const sending = useSubmitTransaction({
		run: () => {
			if (!clean || requirement.state !== "ready") throw new Error("form incomplete")
			return moveCreditInBulk({accountNumber: payer.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, rows, discharge})
		},
		again: {to: routeMap.cardConnected.path, label: t("card.connected.again")},
		failedText: t("card.connected.failed"),
		uncertainText: t("card.connected.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: ["card", "connected"]}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={discharge ? t("card.connected.group.dischargeTitle") : t("card.connected.group.chargeTitle")}
			description={t("card.connected.group.question", {count: rows.length})}
			summary={[
				{label: t("card.connected.account"), value: <span dir="ltr">{payer.number}</span>},
				...(rows.length > 0 ? [{label: t("card.connected.group.cards"), value: String(rows.length)}, {label: t("card.connected.group.total"), value: <strong>{money(total)}</strong>}] : []),
			]}
			confirmLabel={discharge ? t("card.connected.discharge") : t("card.connected.charge")}
			pendingLabel={t("card.connected.sending")}
			canConfirm={clean && isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto">
				<div className="flex gap-2" role="group" aria-label={t("card.connected.group.mode")}>
					<Button
						type="button"
						size="sm"
						variant={!discharge ? "default" : "outline"}
						aria-pressed={!discharge}
						disabled={sending.pending}
						onClick={() => {
							setDischarge(false)
							setRows([])
						}}
					>
						{t("card.connected.charge")}
					</Button>
					<Button
						type="button"
						size="sm"
						variant={discharge ? "default" : "outline"}
						aria-pressed={discharge}
						disabled={sending.pending}
						onClick={() => {
							setDischarge(true)
							setRows([])
						}}
					>
						{t("card.connected.discharge")}
					</Button>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="gc-file">{t("card.connected.group.file")}</Label>
					<input
						id="gc-file"
						type="file"
						accept=".xlsx,.xls"
						className="text-sm"
						disabled={read.isPending || sending.pending}
						onChange={(event) => {
							const file = event.target.files?.[0]
							event.target.value = ""
							if (file) read.mutate(file)
						}}
					/>
					<p className="text-xs text-muted-foreground">{read.isPending ? t("card.connected.group.reading") : t("card.connected.group.hint")}</p>
					{read.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{read.error.message || t("card.connected.group.failed")}
						</p>
					) : null}
					{read.isSuccess && rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("card.connected.group.empty")}</p> : null}
				</div>
				{rows.length > 0 ? (
					<ul className="flex flex-col divide-y rounded-md border text-sm">
						{rows.map((row, index) => {
							const ok = row.problem === "" && /^\d{16}$/.test(row.pan) && row.amount > 0
							return (
								<li key={index} className="flex flex-wrap items-baseline justify-between gap-2 p-2">
									<span dir="ltr" className="tabular-nums">
										{formatCardNumber(row.pan)}
									</span>
									{ok ? <span className="font-medium">{money(row.amount)}</span> : <span className="text-destructive">{row.problem || t("card.connected.group.badRow")}</span>}
								</li>
							)
						})}
					</ul>
				) : null}
				{!clean && rows.length > 0 ? <p role="alert" className="text-sm text-destructive">{t("card.connected.group.fix")}</p> : null}
				{clean ? <AccountPassword requirement={requirement} accountNumber={payer.number} codeServiceName={SERVICE} amount={total} value={password} onChange={setPassword} disabled={sending.pending} /> : null}
			</div>
		</ConfirmDialog>
	)
}
