import {Eye, EyeOff} from "lucide-react"
import {useState, type ComponentProps} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"

/** A password input with a button that shows or hides what was typed. */
export function PasswordInput({...props}: Omit<ComponentProps<typeof Input>, "type">) {
	const {t} = useTranslation()
	const [visible, setVisible] = useState(false)
	const Icon = visible ? EyeOff : Eye

	return (
		<div className="flex items-center gap-2">
			<Input {...props} type={visible ? "text" : "password"} dir="ltr" />
			<Button
				type="button"
				variant="outline"
				size="icon"
				aria-label={t("password.show")}
				aria-pressed={visible}
				onClick={() => setVisible((current) => !current)}
			>
				<Icon aria-hidden="true" />
			</Button>
		</div>
	)
}
