import {ArrowRight, ShieldCheck} from "lucide-react"
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

const QUICK_AMOUNTS = [100_000_000, 500_000_000, 1_000_000_000]

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
		<section aria-labelledby="quick-transfer-title" className="flex h-full flex-col gap-4 rounded-[2rem] border bg-card p-5 shadow-card sm:p-6">
			<div className="mb-1">
				<h2 id="quick-transfer-title" className="text-lg font-semibold">
					{t("home.quickTransfer.title")}
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">{t("home.quickTransfer.subtitle")}</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="quick-source">{t("transfer.sourceAccount")}</Label>
				<SourceAccountSelect id="quick-source" serviceName="AccountTransferMoney" value={sourceId} onChange={(account) => setSourceId(account?.id ?? null)} />
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="quick-destination">{t("transfer.destinationAccount")}</Label>
				<Input id="quick-destination" className="h-11" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={15} value={destination} onChange={(event) => setDestination(digits(event.target.value))} />
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="quick-amount">{t("transfer.amount")}</Label>
				<Input
					id="quick-amount"
					className="h-11"
					dir="ltr"
					inputMode="numeric"
					autoComplete="off"
					maxLength={15}
					value={amount}
					onChange={(event) => setAmount(digits(event.target.value).replace(/^0+/, ""))}
				/>
				<div className="grid grid-cols-3 gap-2">
					{QUICK_AMOUNTS.map((value) => (
						<button
							key={value}
							type="button"
							onClick={() => setAmount(String(value))}
							className="rounded-lg border px-2 py-1.5 text-xs tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
						>
							{formatAmount(value, i18n.language)}
						</button>
					))}
				</div>
				{amount !== "" ? <p className="text-sm text-muted-foreground">{`${formatAmount(Number(amount), i18n.language)} ${t("transfer.rial")}`}</p> : null}
			</div>
			<Button
				type="button"
				className="h-11 w-full"
				onClick={() => {
					const state: TransferPrefill = {sourceId, destination, amount}
					void navigate(routeMap.transferSmart.path, {state})
				}}
			>
				{t("home.quickTransfer.continue")}
				<ArrowRight className="rtl:-scale-x-100" />
			</Button>
			<p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
				<ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
				{t("home.quickTransfer.safe")}
			</p>
		</section>
	)
}
