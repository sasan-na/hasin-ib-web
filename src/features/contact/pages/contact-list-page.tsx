import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {Mail, Pencil, Phone, Plus, Trash2} from "lucide-react"
import * as React from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Skeleton} from "@/components/ui/skeleton"
import {deleteContact, type Contact, type ContactEntry} from "@/features/contact/api/contact"
import {contactKeys, contactsOptions} from "@/features/contact/api/contact.queries"
import {formatCardNumber} from "@/lib/format"

const matches = (contact: Contact, query: string): boolean => {
	if (query === "") return true
	const needle = query.toLowerCase()
	const numbers = [...contact.accounts, ...contact.cards, ...contact.ibans, ...contact.loanAccounts, ...contact.loanCards, ...contact.etcs].map((entry) => `${entry.number} ${entry.name}`)
	return [`${contact.name} ${contact.family}`, contact.mobile, contact.email, ...numbers].some((value) => value.toLowerCase().includes(needle))
}

/** The user's saved people and the accounts, cards and IBANs they use for them. */
export default function ContactListPage() {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const contacts = useQuery(contactsOptions())
	const [query, setQuery] = React.useState("")
	const [toDelete, setToDelete] = React.useState<Contact | null>(null)
	const [notice, setNotice] = React.useState<{ok: boolean; text: string} | null>(null)

	const remove = useMutation({
		mutationFn: (id: number) => deleteContact(id),
		onSuccess: (result) => {
			setNotice({ok: result.ok, text: result.ok ? t("contact.deleted") : result.message || t("contact.deleteFailed")})
			setToDelete(null)
			void queryClient.invalidateQueries({queryKey: contactKeys.all})
		},
		onError: () => {
			setNotice({ok: false, text: t("contact.deleteFailed")})
			setToDelete(null)
		},
	})

	const visible = (contacts.data ?? []).filter((contact) => matches(contact, query.trim()))

	const group = (title: string, list: ContactEntry[], format?: (number: string) => string, prefix = "") =>
		list.length === 0 ? null : (
			<div className="flex flex-col gap-1">
				<h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
				<ul className="flex flex-col gap-1">
					{list.map((entry, index) => (
						<li key={`${entry.number}-${String(index)}`} className="flex flex-wrap justify-between gap-2 text-sm">
							<span>{entry.name}</span>
							<span dir="ltr" className="font-mono">
								{prefix}
								{format ? format(entry.number) : entry.number}
							</span>
						</li>
					))}
				</ul>
			</div>
		)

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("contact.title")}</h1>
				<Button asChild size="sm">
					<Link to={routeMap.contactNew.path}>
						<Plus aria-hidden="true" />
						{t("contact.newTitle")}
					</Link>
				</Button>
			</div>

			<Input type="search" aria-label={t("contact.search")} placeholder={t("contact.search")} value={query} onChange={(event) => setQuery(event.target.value)} />

			{notice ? (
				<p role={notice.ok ? "status" : "alert"} className={`rounded-lg border bg-card p-4 text-sm ${notice.ok ? "" : "text-destructive"}`}>
					{notice.text}
				</p>
			) : null}

			{contacts.isPending ? (
				<div className="flex flex-col gap-3" aria-hidden="true">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : contacts.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{contacts.error.message || t("contact.error")}
				</p>
			) : visible.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{contacts.data.length === 0 ? t("contact.empty") : t("contact.noMatch")}</p>
			) : (
				<ul className="grid gap-4 md:grid-cols-2">
					{visible.map((contact) => (
						<li key={contact.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
							<div className="flex items-start justify-between gap-2">
								<div className="flex min-w-0 flex-col gap-1">
									<h2 className="truncate text-base font-semibold">{`${contact.name} ${contact.family}`.trim()}</h2>
									{contact.mobile ? (
										<span className="flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
											<Phone aria-hidden="true" className="size-3.5" />
											{contact.mobile}
										</span>
									) : null}
									{contact.email ? (
										<span className="flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
											<Mail aria-hidden="true" className="size-3.5" />
											{contact.email}
										</span>
									) : null}
								</div>
								<div className="flex shrink-0">
									<Button asChild variant="ghost" size="icon" aria-label={t("contact.edit")}>
										<Link to={`${routeMap.contactEdit.path}?id=${String(contact.id)}`}>
											<Pencil aria-hidden="true" />
										</Link>
									</Button>
									<Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={t("contact.delete")} onClick={() => setToDelete(contact)}>
										<Trash2 aria-hidden="true" />
									</Button>
								</div>
							</div>
							{group(t("contact.accounts"), contact.accounts)}
							{group(t("contact.cards"), contact.cards, formatCardNumber)}
							{group(t("contact.ibans"), contact.ibans, undefined, "IR")}
							{group(t("contact.loanAccounts"), contact.loanAccounts)}
							{group(t("contact.loanCards"), contact.loanCards, formatCardNumber)}
							{group(t("contact.etcs"), contact.etcs)}
						</li>
					))}
				</ul>
			)}

			<AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !remove.isPending && setToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("contact.deleteTitle")}</AlertDialogTitle>
						<AlertDialogDescription>{t("contact.deleteQuestion", {name: toDelete ? `${toDelete.name} ${toDelete.family}`.trim() : ""})}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>{t("contact.cancel")}</AlertDialogCancel>
						<Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete.id)}>
							{remove.isPending ? t("contact.deleting") : t("contact.delete")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
