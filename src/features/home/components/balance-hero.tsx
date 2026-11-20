import {useIsFetching, useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeftRight, Eye, EyeOff, FileText, Receipt, RefreshCw, Sparkles} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {accountsOptions} from "@/features/account/api/account.queries"
import {formatAmount} from "@/lib/format"
import {cn} from "@/lib/utils"
import {MASK, usePrivacyStore} from "@/store/privacy"

const GHOST =
	"h-11 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-4 text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground"

/** The sum of the balances the user's accounts report, with the switch that masks amounts on the whole page. */
export function BalanceHero() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const hidden = usePrivacyStore((s) => s.hidden)
	const toggle = usePrivacyStore((s) => s.toggle)
	const options = accountsOptions(i18n.language)
	const accounts = useQuery(options)
	const refreshing = useIsFetching({queryKey: options.queryKey}) > 0

	const known = (accounts.data ?? []).filter((account) => account.balances.available !== null)
	const total = known.reduce((sum, account) => sum + (account.balances.available ?? 0), 0)

	return (
		<section aria-labelledby="hero-title" className="relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-card sm:p-8 lg:p-10">
			<div aria-hidden="true" className="absolute -top-24 -end-20 -z-10 size-72 rounded-full border border-primary-foreground/10" />
			<div aria-hidden="true" className="absolute -bottom-32 end-16 -z-10 size-80 rounded-full bg-primary-foreground/5" />

			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2 text-xs text-primary-foreground/70">
						<Sparkles aria-hidden="true" className="size-4" />
						<span>{t("home.hero.overview")}</span>
					</div>
					<h2 id="hero-title" className="mt-4 text-sm font-medium text-primary-foreground/80">
						{t("home.hero.total")}
					</h2>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={toggle}
						aria-pressed={hidden}
						aria-label={hidden ? t("home.hero.show") : t("home.hero.hide")}
						className="size-10 rounded-xl text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
					>
						{hidden ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						disabled={refreshing}
						onClick={() => void queryClient.invalidateQueries({queryKey: options.queryKey})}
						aria-label={t("home.hero.refresh")}
						className="size-10 rounded-xl text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
					>
						<RefreshCw className={cn("size-5", refreshing && "animate-spin")} />
					</Button>
				</div>
			</div>

			<div className="mt-2" aria-live="polite">
				{accounts.isPending ? (
					<Skeleton className="h-11 w-64 bg-primary-foreground/20" />
				) : accounts.isError ? (
					<p role="alert" className="text-sm">
						{t("home.wallet.error")}
					</p>
				) : known.length === 0 ? (
					<p className="text-lg font-semibold">{t("home.hero.none")}</p>
				) : (
					<p className="text-2xl font-extrabold tracking-tight tabular-nums sm:text-4xl lg:text-5xl">
						{hidden ? MASK : formatAmount(total, i18n.language)}
						<span className="ms-3 text-sm font-normal text-primary-foreground/70">{t("home.wallet.rial")}</span>
					</p>
				)}
				{known.length > 0 ? <p className="mt-2 text-xs text-primary-foreground/70">{t("home.hero.basedOn", {count: known.length})}</p> : null}
			</div>

			<div className="mt-6 flex flex-wrap gap-2.5 sm:mt-8">
				<Button asChild size="lg" className="h-11 rounded-xl bg-primary-foreground px-5 text-primary shadow-none hover:bg-primary-foreground/90">
					<Link to={routeMap.transfer.path}>
						<ArrowLeftRight />
						{t("navigation.transfers")}
					</Link>
				</Button>
				<Button asChild variant="ghost" size="lg" className={GHOST}>
					<Link to={routeMap.billList.path}>
						<Receipt />
						{t("home.hero.bills")}
					</Link>
				</Button>
				<Button asChild variant="ghost" size="lg" className={GHOST}>
					<Link to={routeMap.reportStatement.path}>
						<FileText />
						{t("home.hero.statement")}
					</Link>
				</Button>
			</div>
		</section>
	)
}
