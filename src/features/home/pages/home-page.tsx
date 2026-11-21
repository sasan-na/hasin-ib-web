import {useQuery} from "@tanstack/react-query"
import {Megaphone} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert"
import {BalanceHero} from "@/features/home/components/balance-hero"
import {FavoriteServices} from "@/features/home/components/favorite-services"
import {MonthlySnapshot} from "@/features/home/components/monthly-snapshot"
import {QuickTransfer} from "@/features/home/components/quick-transfer"
import {Wallet} from "@/features/home/components/wallet"
import {UpcomingPayments} from "@/features/home/components/upcoming-payments"
import {HomeWidget} from "@/features/home/components/home-widget"
import {RecentTransactions} from "@/features/home/components/recent-transactions"
import {Skeleton} from "@/components/ui/skeleton"
import {adminMessageOptions, arrangementOptions, profileOptions} from "@/features/home/api/home.queries"
import {useSession} from "@/store/session"

// Tailwind needs whole class names, so the twelve-column widths are listed.
const SPAN: Record<number, string> = {
	1: "md:col-span-1",
	2: "md:col-span-2",
	3: "md:col-span-3",
	4: "md:col-span-4",
	5: "md:col-span-5",
	6: "md:col-span-6",
	7: "md:col-span-7",
	8: "md:col-span-8",
	9: "md:col-span-9",
	10: "md:col-span-10",
	11: "md:col-span-11",
	12: "md:col-span-12",
}

export default function Home() {
	const {t, i18n} = useTranslation()
	const sessionUsername = useSession((s) => s.username)
	const profile = useQuery(profileOptions())
	const adminMessage = useQuery(adminMessageOptions(i18n.language))
	const arrangement = useQuery(arrangementOptions())
	// A user who arranged the page sees their own rows; everyone else (or while it loads or fails) sees the standard one.
	const rows = arrangement.data && !arrangement.data.useDefault ? arrangement.data.rows.filter((row) => row.columns.some((column) => column.widget !== "")) : []

	const today = new Intl.DateTimeFormat(i18n.language === "en" ? "en" : `${i18n.language}-u-ca-persian`, {weekday: "long", day: "numeric", month: "long", year: "numeric"}).format(new Date())

	// A main user has a full name; a sub-user only a username. The bidi isolation marks keep a Latin
	// username from reordering the surrounding Persian sentence.
	const fullName = profile.data?.fullName?.trim() || null
	const name = fullName ?? profile.data?.username ?? sessionUsername ?? ""

	return (
		<div className="flex w-full flex-col">
			<header className="mb-6">
				{profile.isPending ? (
					<Skeleton className="h-9 w-56" />
				) : (
					<>
						<h1 className="text-[1.5rem] leading-9 font-bold tracking-tight wrap-break-word md:text-[1.875rem]">{t("home.welcome", {username: `⁨${name}⁩`})}</h1>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">{t("home.subtitle", {date: today})}</p>
					</>
				)}
			</header>

			{adminMessage.data ? (
				<Alert className="mb-6">
					<Megaphone />
					<AlertTitle>{t("home.adminMessage")}</AlertTitle>
					<AlertDescription>
						{adminMessage.data.url ? (
							<a href={adminMessage.data.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
								{adminMessage.data.message}
							</a>
						) : (
							adminMessage.data.message
						)}
					</AlertDescription>
				</Alert>
			) : null}

			<div className="grid items-stretch gap-5 xl:grid-cols-12">
				<div className="min-w-0 xl:col-span-8">
					<BalanceHero />
				</div>
				<div className="min-w-0 xl:col-span-4">
					<MonthlySnapshot />
				</div>
			</div>

			<div className="mt-5 grid items-stretch gap-5 xl:grid-cols-12">
				<div className="min-w-0 xl:col-span-8">
					<Wallet />
				</div>
				<div className="min-w-0 xl:col-span-4">
					<QuickTransfer />
				</div>
			</div>

			<div className="mt-8">
				<FavoriteServices />
			</div>

			{rows.length === 0 ? (
				<div className="mt-8 grid items-start gap-5 xl:grid-cols-12">
					<div className="min-w-0 xl:col-span-8">
						<RecentTransactions />
					</div>
					<div className="min-w-0 xl:col-span-4">
						<UpcomingPayments />
					</div>
				</div>
			) : (
				<>
					{rows.map((row) => (
						<div key={row.index} className="mt-8 grid items-start gap-5 md:grid-cols-12">
							{row.columns.map((column) =>
								column.widget === "" ? null : (
									<div key={column.index} className={`${SPAN[column.width] ?? "md:col-span-12"} min-w-0`}>
										<HomeWidget widget={column.widget} />
									</div>
								),
							)}
						</div>
					))}
					<div className="mt-8 grid gap-5 xl:grid-cols-12">
						<div className="min-w-0 xl:col-span-4">
							<UpcomingPayments />
						</div>
					</div>
				</>
			)}
		</div>
	)
}
