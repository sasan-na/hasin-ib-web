import {useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link, Navigate, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {CopyButton} from "@/components/copy-button"
import {InlineRename} from "@/components/inline-rename"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {renameCard} from "@/features/card/api/card-info"
import {cardInfoOptions, cardKeys, cardOwnerOptions} from "@/features/card/api/card.queries"
import {formatCardNumber} from "@/lib/format"

/** One card in detail: its number, its name (editable) and its holder. */
export default function CardInfoPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const cardId = Number(params.get("cardId"))
	const valid = Number.isInteger(cardId) && cardId > 0

	const info = useQuery({...cardInfoOptions(cardId), enabled: valid})
	const owner = useQuery({...cardOwnerOptions(cardId), enabled: valid})

	// A missing or mangled id (an old bookmark, a hand-edited address) has nothing to show.
	if (!valid) return <Navigate to={routeMap.cardList.path} replace />

	// "Back" points toward the start side of the page, which flips with the language direction.
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("card.info.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.cardList.path}>
						<BackIcon aria-hidden="true" />
						{t("card.info.back")}
					</Link>
				</Button>
			</div>

			<section aria-label={t("card.info.title")} className="overflow-hidden rounded-lg border bg-card">
				{info.isPending ? (
					<div className="flex flex-col gap-3 p-5" aria-hidden="true">
						<Skeleton className="h-6 w-1/2" />
						<Skeleton className="h-6 w-2/3" />
					</div>
				) : info.isError ? (
					<p role="alert" className="p-5 text-sm text-destructive">
						{t("card.info.error")}
					</p>
				) : (
					<>
						<dl className="flex flex-col gap-4 p-5 text-sm">
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
								<dt className="w-32 shrink-0 text-muted-foreground">{t("card.number")}</dt>
								<dd dir="ltr" className="flex items-center gap-1 tabular-nums">
									{formatCardNumber(info.data.number)}
									<CopyButton value={info.data.number} label={t("card.copyNumber")} />
								</dd>
							</div>
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
								<dt className="w-32 shrink-0 text-muted-foreground">{t("card.info.name")}</dt>
								<dd>
									<InlineRename
										name={info.data.name}
										save={(name) => renameCard(cardId, name)}
										// The list and this page both show the name.
										onSaved={() => queryClient.invalidateQueries({queryKey: cardKeys.all})}
										labels={{
											rename: t("card.info.rename"),
											save: t("card.info.save"),
											cancel: t("card.info.cancel"),
											field: t("card.info.name"),
											required: t("card.info.nameRequired"),
											failed: t("card.info.renameError"),
										}}
									/>
								</dd>
							</div>
						</dl>
						<div className="flex flex-col gap-3 border-t p-5">
							<h2 className="text-base font-semibold">{t("card.info.holder")}</h2>
							{owner.isPending ? (
								<Skeleton className="h-10 w-48" />
							) : owner.isError || owner.data.name === "" ? (
								<p className="text-sm text-muted-foreground">{t("card.info.holderUnknown")}</p>
							) : (
								<div className="flex items-center gap-2 text-sm">
									<Avatar>
										{owner.data.image ? <AvatarImage src={owner.data.image} alt="" /> : null}
										<AvatarFallback>{owner.data.name.slice(0, 1)}</AvatarFallback>
									</Avatar>
									{owner.data.name}
								</div>
							)}
						</div>
					</>
				)}
			</section>
		</div>
	)
}
