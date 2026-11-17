import {Search} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {useNavigate} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Input} from "@/components/ui/input"

/** A small search box: typing a word and pressing Enter opens the search page for it. */
export function HeaderSearch() {
	const {t} = useTranslation()
	const navigate = useNavigate()
	const [text, setText] = useState("")

	return (
		<form
			role="search"
			className="relative hidden w-48 sm:block"
			onSubmit={(event) => {
				event.preventDefault()
				const phrase = text.trim()
				if (phrase !== "") void navigate(`${routeMap.search.path}?phrase=${encodeURIComponent(phrase)}`)
			}}
		>
			<Search aria-hidden="true" className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input className="h-8 ps-8" maxLength={60} value={text} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} onChange={(event) => setText(event.target.value)} />
		</form>
	)
}
