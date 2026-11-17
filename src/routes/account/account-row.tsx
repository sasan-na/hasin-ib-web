import {useMutation} from "@tanstack/react-query"
import {RefreshCw, Users} from "lucide-react"
import {useTranslation} from "react-i18next"

import {CopyButton} from "@/components/copy-button"
import {Button} from "@/components/ui/button"
import {getBalance, type Account, type Balances} from "@/lib/api/account"
import {formatAmount, formatIban, normalizeIban} from "@/lib/format"

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

/** One account: who it is, its numbers (with copy), and its balances on request. */
export function AccountRow({account}: {account: Account}) {
	const {t, i18n} = useTranslation()
	const fresh = useMutation({mutationFn: () => getBalance(account.id)})
	// A fresh answer replaces what the list carried; a failed one leaves the older figures in place.
	const balances: Balances = fresh.data ?? account.balances
	const hasBalance = balances.available !== null || balances.total !== null

	return (
		<li className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-start md:justify-between">
			<div className="flex min-w-0 flex-col gap-3">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h3 className="text-base font-semibold wrap-break-word">{account.name || account.type}</h3>
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

			{account.canSeeBalance ? (
				<div className="flex flex-col gap-3 md:items-end">
					{hasBalance ? (
						<div className="flex flex-col gap-2">
							{balances.available !== null ? (
								<Amount label={t("account.balance")} value={balances.available} language={i18n.language} large />
							) : null}
							{balances.total !== null ? <Amount label={t("account.totalBalance")} value={balances.total} language={i18n.language} /> : null}
							{balances.blocked !== null ? <Amount label={t("account.blockedAmount")} value={balances.blocked} language={i18n.language} /> : null}
						</div>
					) : null}
					{fresh.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("account.balanceError")}
						</p>
					) : null}
					<Button type="button" variant="outline" size="sm" disabled={fresh.isPending} onClick={() => fresh.mutate()}>
						<RefreshCw aria-hidden="true" className={fresh.isPending ? "animate-spin" : undefined} />
						{fresh.isPending ? t("account.loadingBalance") : hasBalance ? t("account.refreshBalance") : t("account.showBalance")}
					</Button>
				</div>
			) : null}
		</li>
	)
}
