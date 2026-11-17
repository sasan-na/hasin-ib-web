import {Logo} from "@/components/logo.tsx";

export default function Loading() {
    return (
        <div
            className="absolute start-0 top-0 flex size-full flex-row items-center justify-center gap-2">
            <Logo size={30}
                  className={"animate-ping fill-primary drop-shadow-md"}/>
        </div>
    )
}