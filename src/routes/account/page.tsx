import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {Skeleton} from "@/components/ui/skeleton"
import {accountsOptions} from "@/lib/api/account.queries"

import {AccountRow} from "./account-row"

/** The user's accounts with their numbers and, on request, their balances. */
export default function AccountPage() {
	const {t, i18n} = useTranslation()
	const accounts = useQuery(accountsOptions(i18n.language))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("account.title")}</h1>
			<section aria-label={t("account.title")} className="overflow-hidden rounded-lg border bg-card">
				{accounts.isPending ? (
					<div className="flex flex-col gap-3 p-5" aria-hidden="true">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : accounts.isError ? (
					<p role="alert" className="p-5 text-sm text-destructive">
						{t("account.error")}
					</p>
				) : accounts.data.length === 0 ? (
					<p className="p-5 text-sm text-muted-foreground">{t("account.empty")}</p>
				) : (
					<ul className="divide-y">
						{accounts.data.map((account) => (
							<AccountRow key={account.id} account={account} />
						))}
					</ul>
				)}
			</section>
		</div>
	)
}
