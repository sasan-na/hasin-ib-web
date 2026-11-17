import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {useSignOut} from "@/hooks/use-sign-out"

// Stub: the change-password flow is a later feature. Users whose password expired land here.
export default function ChangePassword() {
	const {t} = useTranslation("auth")
	const signOut = useSignOut()

	return (
		<Card className="mx-auto w-full max-w-sm">
			<CardHeader className="text-center">
				<CardTitle className="text-xl">{t("changePassword.title")}</CardTitle>
				<CardDescription>{t("changePassword.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Button variant="outline" className="w-full" onClick={() => void signOut()}>
					{t("changePassword.logout")}
				</Button>
			</CardContent>
		</Card>
	)
}
