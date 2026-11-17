import {useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {disconnectCards, moveCredit, type ConnectedCard} from "@/features/card/api/connected-card"
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
