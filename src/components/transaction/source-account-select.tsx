import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import type {SourceAccount} from "@/lib/api/transaction"
import {sourceAccountsOptions} from "@/lib/api/transaction.queries"
import {formatAmount} from "@/lib/format"

interface SourceAccountSelectProps {
	id: string
	/** The bank's name for the service, which decides which accounts may be used ("OpenAccount"). */
	serviceName: string
	value: number | null
	onChange: (account: SourceAccount | null) => void
	invalid?: boolean
}

/** Picks one of the user's accounts for a transaction. Accounts the bank cannot use right now are shown but disabled. */
export function SourceAccountSelect({id, serviceName, value, onChange, invalid = false}: SourceAccountSelectProps) {
	const {t, i18n} = useTranslation()
	const accounts = useQuery(sourceAccountsOptions(serviceName, i18n.language))

	if (accounts.isPending) return <Skeleton className="h-9 w-full" />
	if (accounts.isError) {
		return (
			<p role="alert" className="text-sm text-destructive">
				{t("transaction.accountsError")}
			</p>
		)
	}
	if (accounts.data.length === 0) return <p className="text-sm text-muted-foreground">{t("transaction.noAccounts")}</p>

	return (
		<Select
			value={value === null ? "" : String(value)}
			onValueChange={(next) => onChange(accounts.data.find((account) => String(account.id) === next) ?? null)}
		>
			<SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
				<SelectValue placeholder={t("transaction.chooseAccount")} />
			</SelectTrigger>
			<SelectContent>
				{accounts.data.map((account) => (
					<SelectItem key={account.id} value={String(account.id)} disabled={!account.usable}>
						<span className="flex flex-col items-start gap-0.5">
							<span>
								{account.name || account.type} <span dir="ltr">{account.number}</span>
							</span>
							{!account.usable ? (
								<span className="text-xs text-muted-foreground">{t("transaction.signatoriesNotSynced")}</span>
							) : account.balance !== null ? (
								<span className="text-xs text-muted-foreground">
									{t("account.balance")}: {formatAmount(account.balance, i18n.language)} {t("account.rial")}
								</span>
							) : null}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
