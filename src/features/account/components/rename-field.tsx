import {useQueryClient} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"

import {InlineRename} from "@/components/inline-rename"
import {renameAccount} from "@/features/account/api/account"
import {accountKeys} from "@/features/account/api/account.queries"

interface RenameFieldProps {
	accountId: number
	name: string
}

/** The account's name with an inline edit. */
export function RenameField({accountId, name}: RenameFieldProps) {
	const {t} = useTranslation()
	const queryClient = useQueryClient()

	return (
		<InlineRename
			name={name}
			save={(newName) => renameAccount(accountId, newName)}
			// The list and the details page both show the name.
			onSaved={() => queryClient.invalidateQueries({queryKey: accountKeys.all})}
			labels={{
				rename: t("account.info.rename"),
				save: t("account.info.save"),
				cancel: t("account.info.cancel"),
				field: t("account.info.name"),
				required: t("account.info.nameRequired"),
				failed: t("account.info.renameError"),
			}}
		/>
	)
}
