import {useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Label} from "@/components/ui/label"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {extendUssdToken, type UssdToken} from "@/features/ussd/api/ussd"
import {formatAmount} from "@/lib/format"

// The bank's name for paying the USSD fee from an account: which accounts may pay, the limit and the SMS code.
const SERVICE = "AccountPayUSSDFee"

interface Props {
	token: UssdToken
	onClose: () => void
}

/** Pays the fee that extends a USSD token: which account pays, what it costs and the new expiry date. Mount it only while open. */
export function RenewDialog({token, onClose}: Props) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [source, setSource] = useState<SourceAccount | null>(null)
	const [password, setPassword] = useState("")
	const requirement = usePasswordRequirement({accountId: source?.id ?? null, limitServiceName: SERVICE, amount: token.cost})

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || requirement.state !== "ready") throw new Error("form incomplete")
			return extendUssdToken({sourceAccountNumber: source.number, sourcePassword: requirement.needsPassword ? password : null, sourcePasswordType: requirement.info.type, serial: token.serial})
		},
		again: {to: routeMap.ussd.path, label: t("ussd.again")},
		failedText: t("ussd.failed"),
		uncertainText: t("ussd.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: ["ussd"]}),
	})

	return (
		<ConfirmDialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			title={t("ussd.renewTitle")}
			description={t("ussd.renewQuestion")}
			summary={[
				{label: t("ussd.serial"), value: <span dir="ltr">{token.serial}</span>},
				{label: t("ussd.expiry"), value: <span dir="ltr">{token.expiryDate}</span>},
				...(token.nextExpiryDate ? [{label: t("ussd.newExpiry"), value: <span dir="ltr">{token.nextExpiryDate}</span>}] : []),
				{label: t("ussd.cost"), amount: true, value: `${formatAmount(token.cost, i18n.language)} ${t("ussd.rial")}`},
			]}
			confirmLabel={t("ussd.pay")}
			pendingLabel={t("ussd.sending")}
			canConfirm={source !== null && isPasswordComplete(requirement, password) && !sending.blocked}
			pending={sending.pending}
			error={sending.refusal}
			onConfirm={sending.submit}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="ussd-source">{t("ussd.from")}</Label>
					<SourceAccountSelect
						id="ussd-source"
						serviceName={SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							setPassword("")
						}}
					/>
				</div>
				{source ? <AccountPassword requirement={requirement} accountNumber={source.number} codeServiceName={SERVICE} amount={token.cost} value={password} onChange={setPassword} disabled={sending.pending} /> : null}
			</div>
		</ConfirmDialog>
	)
}
