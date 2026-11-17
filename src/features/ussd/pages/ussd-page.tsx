import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Skeleton} from "@/components/ui/skeleton"
import {Button} from "@/components/ui/button"
import {getUssdTokens, type UssdToken} from "@/features/ussd/api/ussd"
import {RenewDialog} from "@/features/ussd/components/renew-dialog"

/** The user's USSD one-time-password tokens and when each expires, with a way to pay the fee that extends one. */
export default function UssdPage() {
	const {t} = useTranslation()
	const tokens = useQuery({queryKey: ["ussd", "tokens"], queryFn: getUssdTokens, staleTime: 60_000, retry: false})
	const [renewing, setRenewing] = useState<UssdToken | null>(null)

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("ussd.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("ussd.hint")}</p>

			{tokens.isPending ? (
				<Skeleton className="h-28 w-full" />
			) : tokens.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{tokens.error.message || t("ussd.error")}
				</p>
			) : tokens.data.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("ussd.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{tokens.data.map((token) => (
						<li key={token.serial} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-5">
							<dl className="flex flex-col gap-1 text-sm">
								<div className="flex gap-2">
									<dt className="text-muted-foreground">{t("ussd.serial")}:</dt>
									<dd dir="ltr" className="font-medium">
										{token.serial}
									</dd>
								</div>
								<div className="flex gap-2">
									<dt className="text-muted-foreground">{t("ussd.expiry")}:</dt>
									<dd dir="ltr">{token.expiryDate}</dd>
								</div>
							</dl>
							{token.extendable ? (
								<Button type="button" onClick={() => setRenewing(token)}>
									{t("ussd.renew")}
								</Button>
							) : null}
						</li>
					))}
				</ul>
			)}

			{renewing ? <RenewDialog token={renewing} onClose={() => setRenewing(null)} /> : null}
		</div>
	)
}
