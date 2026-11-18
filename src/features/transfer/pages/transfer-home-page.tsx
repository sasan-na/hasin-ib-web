import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {contactsOptions} from "@/features/contact/api/contact.queries"
import {ServiceCards} from "@/features/menu/components/service-cards"
import {transferDestinations} from "@/features/transfer/lib/destinations"

const MAX_CONTACTS = 6

/** Saved contacts that have an account, as shortcuts into the account transfer with the destination filled in. Left out when there are none or they cannot be loaded. */
function ContactShortcuts() {
	const {t} = useTranslation()
	const contacts = useQuery(contactsOptions())
	const shortcuts = (contacts.data ?? [])
		.flatMap((contact) => {
			const account = contact.accounts[0]
			const name = `${contact.name} ${contact.family}`.trim()
			return account && name !== "" ? [{id: contact.id, name, number: account.number}] : []
		})
		.slice(0, MAX_CONTACTS)

	if (shortcuts.length === 0) return null

	return (
		<section aria-labelledby="transfer-contacts" className="mx-auto flex w-full max-w-5xl flex-col gap-4">
			<h2 id="transfer-contacts" className="text-lg font-semibold">
				{t("transfer.landing.contacts")}
			</h2>
			<ul className="flex flex-wrap gap-3">
				{shortcuts.map((shortcut) => (
					<li key={shortcut.id}>
						<Link
							to={routeMap.transferSmart.path}
							state={{sourceId: null, destination: shortcut.number, amount: ""}}
							className="flex min-h-11 items-center gap-3 rounded-full border bg-card py-1.5 ps-1.5 pe-4 shadow-card hover:border-primary/40"
						>
							<span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
								{shortcut.name.charAt(0)}
							</span>
							<span className="flex flex-col text-sm leading-tight">
								<span className="font-medium">{shortcut.name}</span>
								<span dir="ltr" className="text-start text-xs text-muted-foreground">
									{shortcut.number}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

/** The transfer section's front page. */
export default function TransferHomePage() {
	const {t} = useTranslation()
	return (
		<div className="flex flex-col gap-8">
			<ServiceCards section="TransferMoney" title={t("transfer.landing.title")} destinations={transferDestinations} />
			<ContactShortcuts />
		</div>
	)
}
