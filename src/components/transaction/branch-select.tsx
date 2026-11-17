import {useQuery} from "@tanstack/react-query"
import {Check, ChevronsUpDown} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Command, CommandEmpty, CommandInput, CommandItem, CommandList} from "@/components/ui/command"
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover"
import {Skeleton} from "@/components/ui/skeleton"
import {branchesOptions} from "@/lib/api/openAccount.queries"
import {cn} from "@/lib/utils"

interface BranchSelectProps {
	id: string
	/** The chosen branch code, or "". */
	value: string
	onChange: (code: string) => void
	invalid?: boolean
}

/** A searchable list of the bank's branches (there are too many for a plain dropdown). */
export function BranchSelect({id, value, onChange, invalid = false}: BranchSelectProps) {
	const {t, i18n} = useTranslation()
	const [open, setOpen] = useState(false)
	const branches = useQuery(branchesOptions(i18n.language))

	if (branches.isPending) return <Skeleton className="h-9 w-full" />
	if (branches.isError) {
		return (
			<p role="alert" className="text-sm text-destructive">
				{t("transaction.branchesError")}
			</p>
		)
	}

	const chosen = branches.data.find((branch) => branch.code === value)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-invalid={invalid}
					className="w-full justify-between font-normal"
				>
					<span className={cn("truncate", !chosen && "text-muted-foreground")}>{chosen ? chosen.name : t("transaction.chooseBranch")}</span>
					<ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
				<Command>
					<CommandInput placeholder={t("transaction.searchBranch")} />
					<CommandList>
						<CommandEmpty>{t("transaction.noBranch")}</CommandEmpty>
						{branches.data.map((branch) => (
							<CommandItem
								key={branch.code}
								// The search matches on this text, so the code is searchable too.
								value={`${branch.name} ${branch.code}`}
								onSelect={() => {
									onChange(branch.code)
									setOpen(false)
								}}
							>
								<Check aria-hidden="true" className={cn("size-4", branch.code === value ? "opacity-100" : "opacity-0")} />
								<span className="wrap-break-word">{branch.name}</span>
								<span dir="ltr" className="ms-auto text-xs text-muted-foreground tabular-nums">
									{branch.code}
								</span>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
