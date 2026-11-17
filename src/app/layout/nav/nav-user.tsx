import {LogOut} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {useSignOut} from "@/features/auth/hooks/use-sign-out"
import {useSession} from "@/store/session"

export function NavUser() {
	const {t} = useTranslation()
	const username = useSession((s) => s.username)
	const signOut = useSignOut()

	return (
		<div className="flex items-center gap-2 p-2">
			<span className="min-w-0 flex-1 truncate text-sm font-medium" dir="ltr">
				{username}
			</span>
			<Button variant="ghost" size="icon" aria-label={t("auth.signOut")} onClick={() => void signOut()}>
				<LogOut aria-hidden="true" className="rtl:-scale-x-100" />
			</Button>
		</div>
	)
}
