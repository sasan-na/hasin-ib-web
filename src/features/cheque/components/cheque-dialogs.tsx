import {useMutation, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {blockCheque, confirmChequeAmount, getChequeHistory, type Cheque, type ChequeHistoryEntry} from "@/features/cheque/api/cheque"
import {chequeKeys} from "@/features/cheque/api/cheque.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's names for these services: the SMS code and the no-password limit.
const HISTORY_SERVICE = "ChequeStatusHistory"
const BLOCK_SERVICE = "BlockCheque"
const CONFIRM_SERVICE = "ChequeAmountConfirm"

interface Props {
	account: SourceAccount
	cheque: Cheque
	onClose: () => void
}

/** Shows the status changes of one cheque, after the account's password is given. Mount it only while open. */
export function ChequeHistoryDialog({account, cheque, onClose}: Props) {
	const {t} = useTranslation()
	const [password, setPassword] = useState("")
	const requirement = usePasswordRequirement({accountId: account.id, limitServiceName: HISTORY_SERVICE, amount: 0})
	const [entries, setEntries] = useState<ChequeHistoryEntry[] | null>(null)

	const load = useMutation({
		mutationFn: () => {
			if (requirement.state !== "ready") throw new Error("form incomplete")
			return getChequeHistory({accountNumber: account.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, series: cheque.series, serial: cheque.serial})
		},
		onSuccess: (history) => {
			// The password has done its job; do not keep it around.
			setPassword("")
			setEntries(history)
		},
	})

	return (
		<Dialog open onOpenChange={(open) => !open && !load.isPending && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("cheque.history.title")}</DialogTitle>
					<DialogDescription>
						<span dir="ltr">
							{cheque.series} / {cheque.serial}
						</span>
					</DialogDescription>
				</DialogHeader>

				{entries === null ? (
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault()
							if (isPasswordComplete(requirement, password) && !load.isPending) load.mutate()
						}}
					>
						<AccountPassword requirement={requirement} accountNumber={account.number} codeServiceName={HISTORY_SERVICE} amount={0} value={password} onChange={setPassword} disabled={load.isPending} />
						{load.isError ? (
							<p role="alert" className="text-sm text-destructive">
								{load.error.message || t("cheque.history.error")}
							</p>
						) : null}
						<DialogFooter>
							<Button type="submit" disabled={!isPasswordComplete(requirement, password) || load.isPending}>
								{load.isPending ? t("cheque.history.loading") : t("cheque.history.show")}
							</Button>
						</DialogFooter>
					</form>
				) : entries.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("cheque.history.empty")}</p>
				) : (
					<ul className="flex max-h-80 flex-col gap-3 overflow-auto">
						{entries.map((entry, index) => (
							<li key={index} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
								<span className="font-medium">
									{entry.from} → {entry.to}
								</span>
								<span className="text-xs text-muted-foreground">{[entry.date, entry.unit].filter(Boolean).join(" · ")}</span>
							</li>
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	)
}

/** Confirms blocking a cheque and asks for the account's password. Mount it only while open. */
export function BlockChequeDialog({account, cheque, onClose}: Props) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const [password, setPassword] = useState("")
	const requirement = usePasswordRequirement({accountId: account.id, limitServiceName: BLOCK_SERVICE, amount: 0})

	const sending = useSubmitTransaction({
		run: () => {
			if (requirement.state !== "ready") throw new Error("form incomplete")
			return blockCheque({accountNumber: account.number, password: requirement.needsPassword ? password : null, passwordType: requirement.info.type, series: cheque.series, serial: cheque.serial})
		},
		again: {to: routeMap.chequeList.path, label: t("cheque.block.backToList")},
		failedText: t("cheque.block.failed"),
		uncertainText: t("cheque.block.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: chequeKeys.all}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("cheque.block.title")}
			description={t("cheque.block.question")}
			summary={[
				{label: t("cheque.account"), value: <span dir="ltr">{account.number}</span>},
				{label: t("cheque.series"), value: <span dir="ltr">{cheque.series}</span>},
				{label: t("cheque.serial"), value: <span dir="ltr">{cheque.serial}</span>},
				...(cheque.sayyadId ? [{label: t("cheque.sayyadId"), value: <span dir="ltr">{cheque.sayyadId}</span>}] : []),
			]}
			confirmLabel={t("cheque.block.confirm")}
			pendingLabel={t("cheque.block.blocking")}
			canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
			destructive
		>
			<AccountPassword requirement={requirement} accountNumber={account.number} codeServiceName={BLOCK_SERVICE} amount={0} value={password} onChange={setPassword} disabled={sending.pending} />
		</ConfirmDialog>
	)
}

/** Asks for the amount a cheque was written for and the account's password, then tells the bank. Mount it only while open. */
export function ConfirmChequeAmountDialog({account, cheque, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [amount, setAmount] = useState("")
	const [password, setPassword] = useState("")
	const value = amount === "" ? 0 : Number(amount)
	const requirement = usePasswordRequirement({accountId: account.id, limitServiceName: CONFIRM_SERVICE, amount: value})

	const sending = useSubmitTransaction({
		run: () => {
			if (requirement.state !== "ready" || value <= 0) throw new Error("form incomplete")
			return confirmChequeAmount({
				accountNumber: account.number,
				password: requirement.needsPassword ? password : null,
				passwordType: requirement.info.type,
				series: cheque.series,
				serial: cheque.serial,
				amount: value,
			})
		},
		again: {to: routeMap.chequeList.path, label: t("cheque.block.backToList")},
		failedText: t("cheque.confirmAmount.failed"),
		uncertainText: t("cheque.confirmAmount.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: chequeKeys.all}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("cheque.confirmAmount.title")}
			description={t("cheque.confirmAmount.question")}
			summary={[
				{label: t("cheque.account"), value: <span dir="ltr">{account.number}</span>},
				{label: t("cheque.series"), value: <span dir="ltr">{cheque.series}</span>},
				{label: t("cheque.serial"), value: <span dir="ltr">{cheque.serial}</span>},
				...(value > 0 ? [{label: t("cheque.confirmAmount.amount"), value: <strong>{`${formatAmount(value, i18n.language)} ${t("cheque.rial")}`}</strong>}] : []),
			]}
			confirmLabel={t("cheque.confirmAmount.confirm")}
			pendingLabel={t("cheque.confirmAmount.sending")}
			canConfirm={value > 0 && isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="cheque-amount">{t("cheque.confirmAmount.amount")}</Label>
				<Input
					id="cheque-amount"
					dir="ltr"
					inputMode="numeric"
					autoComplete="off"
					maxLength={15}
					value={amount}
					disabled={sending.pending}
					onChange={(event) => setAmount(normalizeDigits(event.target.value).replace(/\D/g, "").replace(/^0+/, ""))}
				/>
				{value > 0 ? <p className="text-sm text-muted-foreground">{`${formatAmount(value, i18n.language)} ${t("cheque.rial")}`}</p> : null}
			</div>
			<AccountPassword requirement={requirement} accountNumber={account.number} codeServiceName={CONFIRM_SERVICE} amount={value} value={password} onChange={setPassword} disabled={sending.pending} />
		</ConfirmDialog>
	)
}
