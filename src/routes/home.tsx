import {useQuery} from "@tanstack/react-query"
import {Megaphone} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {RecentTransactions} from "@/components/recent-transactions"
import {Skeleton} from "@/components/ui/skeleton"
import {adminMessageOptions, profileOptions} from "@/lib/api/home.queries"
import {useSession} from "@/store/session"

export default function Home() {
	const {t, i18n} = useTranslation()
	const sessionUsername = useSession((s) => s.username)
	const profile = useQuery(profileOptions())
	const adminMessage = useQuery(adminMessageOptions(i18n.language))

	// A main user has a full name; a sub-user only a username. The bidi isolation marks keep a Latin
	// username from reordering the surrounding Persian sentence.
	const fullName = profile.data?.fullName?.trim() || null
	const name = fullName ?? profile.data?.username ?? sessionUsername ?? ""
	const image = profile.data?.image || undefined

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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

			<RecentTransactions />
		</div>
	)
}
