import {useTranslation} from "react-i18next"

import {useSession} from "@/store/session"

export default function Home() {
	const {t} = useTranslation()
	const username = useSession((s) => s.username)

	return <h1 className="text-xl font-semibold">{t("home.welcome", {username})}</h1>
}
