import {Eye, EyeOff} from "lucide-react"
import {useState} from "react"
import type {Control} from "react-hook-form"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form"
import {Input} from "@/components/ui/input"

import {LOGIN_LIMITS, type LoginFormData} from "../lib/login-schema"

/** The password input with a button that shows or hides what was typed. */
export function PasswordField({control}: {control: Control<LoginFormData>}) {
	const {t} = useTranslation("auth")
	const [visible, setVisible] = useState(false)
	const Icon = visible ? EyeOff : Eye

	return (
		<FormField
			control={control}
			name="password"
			render={({field}) => (
				<FormItem>
					<FormLabel>{t("login.password")}</FormLabel>
					<div className="flex items-center gap-2">
						<FormControl>
							<Input
								{...field}
								type={visible ? "text" : "password"}
								autoComplete="current-password"
								dir="ltr"
								maxLength={LOGIN_LIMITS.PASSWORD_MAX}
							/>
						</FormControl>
						<Button
							type="button"
							variant="outline"
							size="icon"
							aria-label={t("login.showPassword")}
							aria-pressed={visible}
							onClick={() => setVisible((current) => !current)}
						>
							<Icon aria-hidden="true" />
						</Button>
					</div>
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}
