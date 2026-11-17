import {Logo} from "@/components/ui/logo.tsx";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button.tsx";
import {ArrowLeft} from "lucide-react";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div
            className="absolute left-0 top-0 flex size-full flex-row items-center justify-center gap-2">
            <Button onClick={() => navigate("/")}
                    variant={"outline"}
                    className={"absolute left-4 top-16"}><ArrowLeft/> Back</Button>
            <Logo size={22}
                  className={"animate-pulse fill-primary drop-shadow-md"}/>
            <h1 className={"font-semibold tracking-wider text-primary drop-shadow-md"}>
                404
            </h1>
        </div>
    )
}
