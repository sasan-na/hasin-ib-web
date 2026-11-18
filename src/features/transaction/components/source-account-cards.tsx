import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {Skeleton} from "@/components/ui/skeleton"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {sourceAccountsOptions} from "@/features/transaction/api/transaction.queries"
import {ChoiceCards} from "@/components/flow/choice-cards"
import {formatAmount} from "@/lib/format"

interface SourceAccountCardsProps {
	/** The bank's name for the service, which decides which accounts may be used. */
	serviceName: string
	value: number | null
	onChange: (account: SourceAccount) => void
	/** Id of the element that names the group. */
	labelledBy: string
}

/** The user's accounts as cards to pick from. Accounts the bank cannot use right now are shown but disabled. */
export function SourceAccountCards({serviceName, value, onChange, labelledBy}: SourceAccountCardsProps) {
	const {t, i18n} = useTranslation()
	const accounts = useQuery(sourceAccountsOptions(serviceName, i18n.language))

	if (accounts.isPending) return <Skeleton className="h-24 w-full" />
	if (accounts.isError) {
		return (
			<p role="alert" className="text-sm text-destructive">
				{t("transaction.accountsError")}
			</p>
		)
	}
	if (accounts.data.length === 0) return <p className="text-sm text-muted-foreground">{t("transaction.noAccounts")}</p>

	return (
		<ChoiceCards
			name="transfer-source"
			labelledBy={labelledBy}
			value={value}
			onChange={(id) => {
				const account = accounts.data.find((candidate) => candidate.id === id)
				if (account) onChange(account)
			}}
			choices={accounts.data.map((account) => ({
				id: account.id,
				title: account.name || account.type,
				number: account.number,
				disabled: !account.usable,
				note: !account.usable ? (
					<span className="text-xs text-muted-foreground">{t("transaction.signatoriesNotSynced")}</span>
				) : account.balance !== null ? (
					<span className="font-semibold">
						{formatAmount(account.balance, i18n.language)} <span className="text-xs font-normal text-muted-foreground">{t("account.rial")}</span>
					</span>
				) : null,
			}))}
		/>
	)
}
