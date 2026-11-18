import {BookOpenCheck, FileSignature, Handshake, Inbox, PenLine, type LucideIcon} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {TONES} from "@/features/menu/components/service-cards"
import {cn} from "@/lib/utils"

interface Entry {
	key: "cartable" | "issue" | "hold" | "guarantee" | "activate"
	to: string
	icon: LucideIcon
	tone: keyof typeof TONES
}

// These pages are this client's own: the bank's menu has no section for digital cheques, so the cards are fixed.
// Issuing starts from a cheque in the digital cheque book, so it opens the cheque list on the digital tab.
const ENTRIES: Entry[] = [
	{key: "cartable", to: routeMap.chakadCartable.path, icon: Inbox, tone: "primary"},
	{key: "issue", to: `${routeMap.chequeList.path}?media=digital`, icon: PenLine, tone: "success"},
	{key: "hold", to: routeMap.chakadCashing.path, icon: BookOpenCheck, tone: "info"},
	{key: "guarantee", to: routeMap.chakadGuarantee.path, icon: Handshake, tone: "warning"},
	{key: "activate", to: routeMap.chakadActivate.path, icon: FileSignature, tone: "primary"},
]

/** The digital cheque section's front page: the cartable, issuing, holding, guarantees and turning the service on. */
export default function DigitalChequeHomePage() {
	const {t} = useTranslation()
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("digitalCheque.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("digitalCheque.hint")}</p>
			<div className="grid gap-6 md:grid-cols-2">
				{ENTRIES.map((entry) => {
					const Icon = entry.icon
					const tone = TONES[entry.tone]
					return (
						<article key={entry.key} className="flex flex-col overflow-hidden rounded-lg border bg-card">
							<Link to={entry.to} className="flex flex-1 flex-col gap-5 p-5 outline-offset-[-2px] hover:bg-muted/40">
								<div className="flex items-center gap-4">
									<h2 className="text-lg font-semibold">{t(`digitalCheque.cards.${entry.key}.title`)}</h2>
									<span aria-hidden="true" className={cn("h-0.5 flex-1", tone.line)} />
									<span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", tone.badge)}>
										<Icon className="size-6" />
									</span>
								</div>
								<p className="text-sm leading-relaxed text-muted-foreground">{t(`digitalCheque.cards.${entry.key}.text`)}</p>
							</Link>
						</article>
					)
				})}
			</div>
		</div>
	)
}
