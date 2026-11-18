import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {useMemo, useState} from "react"
import {useTranslation} from "react-i18next"

import {RefreshCw} from "lucide-react"

import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {moveAccount, type Balances} from "@/features/account/api/account"
import {accountKeys, accountsOptions} from "@/features/account/api/account.queries"
import {formatAmount} from "@/lib/format"
import {syncAllowedOptions, syncUserInfo} from "@/lib/api/sync-user-info"

import {AccountFilters} from "../components/account-filters"
import {AccountRow} from "../components/account-row"
import {categoriesOf, EMPTY_FILTERS, filterAccounts, groupAccounts, groupTotal, hasActiveFilters, type Filters} from "../lib/account-list"

/** The user's accounts, grouped by category, with search, on-request balances and reordering. */
export default function AccountPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const accounts = useQuery(accountsOptions(i18n.language))
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
	// Balances fetched during this visit, by account id; they also feed the group totals.
	const [fresh, setFresh] = useState<Readonly<Record<number, Balances>>>({})
	const [moveFailed, setMoveFailed] = useState(false)

	const move = useMutation({
		mutationFn: ({sourceId, destinationId}: {sourceId: number; destinationId: number}) => moveAccount(sourceId, destinationId),
		onMutate: () => setMoveFailed(false),
		onError: () => setMoveFailed(true),
		// Success or not, the server's order is the truth.
		onSettled: () => queryClient.invalidateQueries({queryKey: accountKeys.all}),
	})

	const syncAllowed = useQuery(syncAllowedOptions())
	const sync = useMutation({
		mutationFn: syncUserInfo,
		// A changed list means the old one (and its order) is stale.
		onSuccess: (result) => (result.hasChanged ? queryClient.invalidateQueries({queryKey: accountKeys.all}) : undefined),
	})

	const filtering = hasActiveFilters(filters)
	const all = accounts.data
	const groups = useMemo(() => (all ? groupAccounts(filterAccounts(all, filters)) : []), [all, filters])
	const categories = useMemo(() => (all ? categoriesOf(all) : []), [all])

	const recordFresh = (accountId: number, balances: Balances): void => setFresh((current) => ({...current, [accountId]: balances}))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("account.listTitle")}</h1>
				{syncAllowed.data ? (
					<Button type="button" variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
						<RefreshCw aria-hidden="true" className={sync.isPending ? "animate-spin" : undefined} />
						{sync.isPending ? t("account.syncing") : t("account.sync")}
					</Button>
				) : null}
			</div>
			{sync.isSuccess ? (
				<p role="status" className="text-sm text-muted-foreground">
					{sync.data.message || (sync.data.hasChanged ? t("account.syncChanged") : t("account.syncUnchanged"))}
				</p>
			) : null}
			{sync.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{sync.error.message || t("account.syncError")}
				</p>
			) : null}

			{accounts.isPending ? (
				<div className="flex flex-col gap-3 rounded-lg border bg-card p-5" aria-hidden="true">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : accounts.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{t("account.error")}
				</p>
			) : accounts.data.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("account.empty")}</p>
			) : (
				<>
					<AccountFilters filters={filters} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} categories={categories} />

					{moveFailed ? (
						<p role="alert" className="text-sm text-destructive">
							{t("account.moveError")}
						</p>
					) : null}

					{groups.length === 0 ? (
						<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("account.noResults")}</p>
					) : (
						groups.map((group) => {
							const total = groupTotal(group.accounts, fresh)
							const headingId = `account-group-${group.key || "none"}`
							return (
								<section key={group.key} aria-labelledby={headingId} className="overflow-hidden rounded-lg bg-card">
									<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-muted/60 px-5 py-3">
										<h2 id={headingId} className="text-base font-semibold">
											{group.name || t("account.listTitle")}
										</h2>
										{total !== null ? (
											<span className="text-sm text-muted-foreground">
												{t("account.groupTotal")}{" "}
												<span className="font-semibold text-foreground tabular-nums">
													{formatAmount(total, i18n.language)} {t("account.rial")}
												</span>
											</span>
										) : null}
									</div>
									<ul className="divide-y">
										{group.accounts.map((account, index) => (
											<AccountRow
												key={account.id}
												account={account}
												fresh={fresh[account.id]}
												onFresh={recordFresh}
												move={
													filtering
														? undefined
														: {
																canMoveUp: index > 0,
																canMoveDown: index < group.accounts.length - 1,
																busy: move.isPending,
																onMove: (direction) => {
																	const target = group.accounts[direction === "up" ? index - 1 : index + 1]
																	move.mutate({sourceId: account.id, destinationId: target.id})
																},
															}
												}
											/>
										))}
									</ul>
								</section>
							)
						})
					)}
				</>
			)}
		</div>
	)
}
