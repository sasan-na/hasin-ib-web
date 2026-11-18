import {Logo} from "@/components/logo.tsx";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button.tsx";
import {useTranslation} from "react-i18next";
import {ArrowLeft} from "lucide-react";

export default function NotFound() {
    const navigate = useNavigate();
    const {t} = useTranslation();

    return (
        <div
            className="absolute start-0 top-0 flex size-full flex-row items-center justify-center gap-2">
            <Button onClick={() => navigate("/")}
                    variant={"outline"}
                    className={"absolute start-4 top-16"}><ArrowLeft className="rtl:rotate-180"/> {t("button.back")}</Button>
            <Logo size={22}
                  className={"motion-safe:animate-pulse fill-primary drop-shadow-md"}/>
            <h1 className={"font-semibold tracking-wider text-brand drop-shadow-md"}>
                404
            </h1>
        </div>
    )
}
