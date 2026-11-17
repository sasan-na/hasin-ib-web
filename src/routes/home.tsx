import {useQuery} from "@tanstack/react-query"
import {Megaphone} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Card, CardContent} from "@/components/ui/card"
import {Skeleton} from "@/components/ui/skeleton"
import {adminMessageOptions, profileOptions} from "@/lib/api/home.queries"
import {useSession} from "@/store/session"

export default function Home() {
	const {t} = useTranslation()
	const sessionUsername = useSession((s) => s.username)
	const profile = useQuery(profileOptions())
	const adminMessage = useQuery(adminMessageOptions())

	// A main user has a full name; a sub-user only a username. The bidi isolation marks keep a Latin
	// username from reordering the surrounding Persian sentence.
	const fullName = profile.data?.fullName?.trim() || null
	const name = fullName ?? profile.data?.username ?? sessionUsername ?? ""
	const image = profile.data?.image || undefined

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardContent className="flex items-center gap-4">
					<Avatar size="lg" className="size-14">
						{image ? <AvatarImage src={image} alt="" /> : null}
						<AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
					</Avatar>
					{profile.isPending ? (
						<Skeleton className="h-6 w-48" />
					) : (
						<h1 className="text-xl font-semibold wrap-break-word">
							{t("home.welcome", {username: `⁨${name}⁩`})}
						</h1>
					)}
				</CardContent>
			</Card>

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
		</div>
	)
}
