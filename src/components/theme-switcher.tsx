import {Monitor, Moon, Sun} from "lucide-react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {useIsDarkMode} from "@/hooks/use-is-dark-mode"
import {useThemeStore, type Theme} from "@/store/theme"

const OPTIONS: {value: Theme; icon: typeof Sun}[] = [
	{value: "light", icon: Sun},
	{value: "dark", icon: Moon},
	{value: "system", icon: Monitor},
]

/** A menu to choose the light, dark or system theme. */
export function ThemeSwitcher({className}: {className?: string}) {
	const {t} = useTranslation()
	const theme = useThemeStore((s) => s.theme)
	const setTheme = useThemeStore((s) => s.setTheme)
	// The trigger shows what is on screen right now, which for "system" depends on the OS.
	const Icon = useIsDarkMode() ? Moon : Sun

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className={className} aria-label={t("theme.label")}>
					<Icon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
					{OPTIONS.map(({value, icon: OptionIcon}) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<OptionIcon />
							{t(`theme.${value}`)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
