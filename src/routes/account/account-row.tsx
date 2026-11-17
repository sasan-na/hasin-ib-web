import {useMutation} from "@tanstack/react-query"
import {ChevronDown, ChevronUp, Info, RefreshCw, Users} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {CopyButton} from "@/components/copy-button"
import {Button} from "@/components/ui/button"
import {getBalance, type Account, type Balances} from "@/lib/api/account"
import {formatAmount, formatIban, normalizeIban} from "@/lib/format"
import {routeMap} from "@/routing.tsx"

function Amount({label, value, language, large = false}: {label: string; value: number; language: string; large?: boolean}) {
	const {t} = useTranslation()
	return (
		<div className="flex flex-col md:items-end">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className={large ? "text-2xl font-extrabold tabular-nums" : "text-base font-medium tabular-nums"}>
				{formatAmount(value, language)} <span className="text-sm font-normal text-muted-foreground">{t("account.rial")}</span>
			</span>
		</div>
	)
}

/** Reordering within a category; absent while a filter is on, because a partial list cannot be reordered sensibly. */
export interface MoveControls {
	canMoveUp: boolean
	canMoveDown: boolean
	busy: boolean
	onMove: (direction: "up" | "down") => void
}

interface AccountRowProps {
	account: Account
	/** The latest balances the user fetched in this visit; they win over what the list carried. */
	fresh?: Balances
	onFresh: (accountId: number, balances: Balances) => void
	move?: MoveControls
}

/** One account: who it is, its numbers (with copy), its balances on request, and where it sits in the list. */
export function AccountRow({account, fresh, onFresh, move}: AccountRowProps) {
	const {t, i18n} = useTranslation()
	const refresh = useMutation({
		mutationFn: () => getBalance(account.id),
		onSuccess: (balances) => onFresh(account.id, balances),
	})
	// A failed refresh leaves the older figures in place.
	const balances: Balances = fresh ?? account.balances
	const hasBalance = balances.available !== null || balances.total !== null
	const name = account.name || account.type

	return (
		<li className="flex gap-3 px-5 py-4">
			{move ? (
				<div className="flex shrink-0 flex-col gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						disabled={!move.canMoveUp || move.busy}
						aria-label={t("account.moveUp", {name})}
						onClick={() => move.onMove("up")}
					>
						<ChevronUp aria-hidden="true" className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						disabled={!move.canMoveDown || move.busy}
						aria-label={t("account.moveDown", {name})}
						onClick={() => move.onMove("down")}
					>
						<ChevronDown aria-hidden="true" className="size-4" />
					</Button>
				</div>
			) : null}
			<div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="flex min-w-0 flex-col gap-3">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h3 className="text-base font-semibold wrap-break-word">{name}</h3>
						{account.name && account.type ? <span className="text-sm text-muted-foreground">{account.type}</span> : null}
						{account.isJoint ? (
							<span className="flex items-center gap-1 text-sm text-muted-foreground">
								<Users aria-hidden="true" className="size-4" />
								{t("account.joint")}
							</span>
						) : null}
					</div>
					<dl className="flex flex-col gap-1 text-sm">
						<div className="flex flex-wrap items-center gap-x-2">
							<dt className="text-muted-foreground">{t("account.number")}</dt>
							<dd dir="ltr" className="flex items-center gap-1 tabular-nums">
								{account.number}
								<CopyButton value={account.number} label={t("account.copyNumber")} />
							</dd>
						</div>
						{account.iban ? (
							<div className="flex flex-wrap items-center gap-x-2">
								<dt className="text-muted-foreground">{t("account.iban")}</dt>
								<dd dir="ltr" className="flex items-center gap-1 tabular-nums">
									{formatIban(account.iban)}
									<CopyButton value={normalizeIban(account.iban)} label={t("account.copyIban")} />
								</dd>
							</div>
						) : null}
						{account.passwordType ? (
							<div className="flex flex-wrap items-center gap-x-2">
								<dt className="text-muted-foreground">{t("account.passwordType.label")}</dt>
								<dd>{t(`account.passwordType.${account.passwordType}`)}</dd>
							</div>
						) : null}
					</dl>
				</div>

				<div className="flex flex-col gap-3 md:items-end">
					{account.canSeeBalance && hasBalance ? (
						<div className="flex flex-col gap-2">
							{balances.available !== null ? (
								<Amount label={t("account.balance")} value={balances.available} language={i18n.language} large />
							) : null}
							{balances.total !== null ? <Amount label={t("account.totalBalance")} value={balances.total} language={i18n.language} /> : null}
							{balances.blocked !== null ? <Amount label={t("account.blockedAmount")} value={balances.blocked} language={i18n.language} /> : null}
						</div>
					) : null}
					{refresh.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("account.balanceError")}
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						{account.canSeeBalance ? (
							<Button type="button" variant="outline" size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
								<RefreshCw aria-hidden="true" className={refresh.isPending ? "animate-spin" : undefined} />
								{refresh.isPending ? t("account.loadingBalance") : hasBalance ? t("account.refreshBalance") : t("account.showBalance")}
							</Button>
						) : null}
						<Button asChild variant="outline" size="sm">
							<Link to={`${routeMap.accountInfo.path}?accountId=${account.id}`} aria-label={t("account.infoFor", {name})}>
								<Info aria-hidden="true" />
								{t("account.infoButton")}
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</li>
	)
}
