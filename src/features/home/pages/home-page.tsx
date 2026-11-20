import {useQuery} from "@tanstack/react-query"
import {Megaphone} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
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

	// A main user has a full name; a sub-user only a username. The bidi isolation marks keep a Latin
	// username from reordering the surrounding Persian sentence.
	const fullName = profile.data?.fullName?.trim() || null
	const name = fullName ?? profile.data?.username ?? sessionUsername ?? ""
	const image = profile.data?.image || undefined

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
			<header className="flex items-center gap-4">
				<Avatar size="lg" className="size-14">
					{image ? <AvatarImage src={image} alt="" /> : null}
					<AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
				</Avatar>
				{profile.isPending ? (
					<Skeleton className="h-8 w-56" />
				) : (
					<h1 className="text-2xl font-bold wrap-break-word">
						{t("home.welcome", {username: `⁨${name}⁩`})}
					</h1>
				)}
			</header>

			{adminMessage.data ? (
				<Alert>
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

			<BalanceHero />

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<Wallet />
				<QuickTransfer />
			</div>

			<div className="grid items-start gap-6 md:grid-cols-2">
				<MonthlySnapshot />
				<UpcomingPayments />
			</div>

			<FavoriteServices />

			{rows.length === 0 ? (
				<RecentTransactions />
			) : (
				rows.map((row) => (
					<div key={row.index} className="grid items-start gap-6 md:grid-cols-12">
						{row.columns.map((column) =>
							column.widget === "" ? null : (
								<div key={column.index} className={`${SPAN[column.width] ?? "md:col-span-12"} min-w-0`}>
									<HomeWidget widget={column.widget} />
								</div>
							),
						)}
					</div>
				))
			)}
		</div>
	)
}
