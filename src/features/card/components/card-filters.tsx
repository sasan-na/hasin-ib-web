import {ChevronDown, Search} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {hasActiveFilters, type Category, type Filters} from "@/features/card/lib/card-list"
import {cn} from "@/lib/utils"

interface CardFiltersProps {
	filters: Filters
	onChange: (filters: Filters) => void
	onReset: () => void
	categories: Category[]
}

// Radix Select cannot hold an empty value, so "all categories" travels as this marker.
const ALL = "__all__"

/** The collapsible search panel above the card list: by name, card number and category. */
export function CardFilters({filters, onChange, onReset, categories}: CardFiltersProps) {
	const {t} = useTranslation()
	const [open, setOpen] = useState(false)
	const active = hasActiveFilters(filters)

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
			<CollapsibleTrigger asChild>
				<Button type="button" variant="ghost" className="h-12 w-full justify-start gap-2 px-5 text-base font-semibold">
					<Search aria-hidden="true" />
					{t("card.search.title")}
					{active ? <span className="size-2 rounded-full bg-primary" aria-label={t("card.search.active")} /> : null}
					<ChevronDown aria-hidden="true" className={cn("ms-auto transition-transform", open && "rotate-180")} />
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="grid gap-4 border-t p-5 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="card-filter-name">{t("card.search.name")}</Label>
						<Input id="card-filter-name" value={filters.name} onChange={(event) => onChange({...filters, name: event.target.value})} />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="card-filter-number">{t("card.number")}</Label>
						<Input
							id="card-filter-number"
							dir="ltr"
							inputMode="numeric"
							value={filters.number}
							onChange={(event) => onChange({...filters, number: event.target.value})}
						/>
					</div>
					{categories.length > 1 ? (
						<div className="flex flex-col gap-2">
							<Label htmlFor="card-filter-category">{t("card.search.category")}</Label>
							<Select
								value={filters.category === "" ? ALL : filters.category}
								onValueChange={(value) => onChange({...filters, category: value === ALL ? "" : value})}
							>
								<SelectTrigger id="card-filter-category" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL}>{t("card.search.allCategories")}</SelectItem>
									{categories.map((category) => (
										<SelectItem key={category.key} value={category.key}>
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<div className="sm:col-span-2">
						<Button type="button" variant="outline" size="sm" disabled={!active} onClick={onReset}>
							{t("card.search.reset")}
						</Button>
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}
