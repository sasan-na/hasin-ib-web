import {useState} from "react"
import {useTranslation} from "react-i18next"
import {useNavigate} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import type {TransferPrefill} from "@/features/transfer/lib/prefill"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/**
 * A shortcut into the transfer page: pick the paying account, type who and how much, and carry on there. Nothing
 * is sent from here; the transfer page still checks the holder and asks for confirmation.
 */
export function QuickTransfer() {
	const {t, i18n} = useTranslation()
	const navigate = useNavigate()
	const [sourceId, setSourceId] = useState<number | null>(null)
	const [destination, setDestination] = useState("")
	const [amount, setAmount] = useState("")

	return (
		<section aria-labelledby="quick-transfer-title" className="flex h-full flex-col gap-4 rounded-lg bg-card p-5">
			<h2 id="quick-transfer-title" className="text-base font-semibold">
				{t("home.quickTransfer.title")}
			</h2>
			<div className="flex flex-col gap-2">
				<Label htmlFor="quick-source">{t("transfer.sourceAccount")}</Label>
				<SourceAccountSelect id="quick-source" serviceName="AccountTransferMoney" value={sourceId} onChange={(account) => setSourceId(account?.id ?? null)} />
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="quick-destination">{t("transfer.destinationAccount")}</Label>
				<Input id="quick-destination" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={15} value={destination} onChange={(event) => setDestination(digits(event.target.value))} />
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="quick-amount">{t("transfer.amount")}</Label>
				<Input
					id="quick-amount"
					dir="ltr"
					inputMode="numeric"
					autoComplete="off"
					maxLength={15}
					value={amount}
					onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))}
				/>
				{amount !== "" ? <p className="text-sm text-muted-foreground">{`${formatAmount(Number(amount), i18n.language)} ${t("transfer.rial")}`}</p> : null}
			</div>
			<Button
				type="button"
				onClick={() => {
					const state: TransferPrefill = {sourceId, destination, amount}
					void navigate(routeMap.transferSmart.path, {state})
				}}
			>
				{t("home.quickTransfer.continue")}
			</Button>
		</section>
	)
}
