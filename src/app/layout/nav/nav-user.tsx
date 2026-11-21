import {LogOut} from "lucide-react"
import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {useSignOut} from "@/features/auth/hooks/use-sign-out"
import {profileOptions} from "@/features/home/api/home.queries"
import {useSession} from "@/store/session"

export function NavUser() {
	const {t} = useTranslation()
	const username = useSession((s) => s.username)
	const profile = useQuery(profileOptions())
	const signOut = useSignOut()
	const name = profile.data?.fullName?.trim() || profile.data?.username || username || ""

	return (
		<div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:p-0">
			<Link to={routeMap.profile.path} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-sidebar-accent" aria-label={t("profile.title")}>
				<Avatar className="size-10 shrink-0">
					{profile.data?.image ? <AvatarImage src={profile.data.image} alt="" /> : null}
					<AvatarFallback className="bg-primary-soft text-sm font-bold text-primary">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1 truncate text-sm font-semibold group-data-[collapsible=icon]:hidden" dir="auto">
					{name}
				</span>
			</Link>
			<Button variant="ghost" size="icon" aria-label={t("auth.signOut")} onClick={() => void signOut()} className="group-data-[collapsible=icon]:hidden">
				<LogOut aria-hidden="true" className="rtl:-scale-x-100" />
			</Button>
		</div>
	)
}
