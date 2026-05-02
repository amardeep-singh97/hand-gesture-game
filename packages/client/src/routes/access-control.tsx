import { PropsWithChildren, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { appTrpc } from "../../src/trpc";
import useRouter from "./_hooks/use-router";
import { appPaths } from "./paths";
import { useLocation } from "react-router";

interface AccessControlProps extends PropsWithChildren {
    onLoginPage?: boolean
}

const ON_LOGIN_PAGE_DEFAULT = false; // stable reference prevents re-renders

export default function AccessControl({ onLoginPage = ON_LOGIN_PAGE_DEFAULT, children } : AccessControlProps) {

    const query =  useQuery(appTrpc.me.queryOptions())
    const { push } = useRouter();
    const location = useLocation();

    useEffect(() => {
        if (query.data && onLoginPage) {
            push(appPaths.landing)
        }

        if (location.pathname === appPaths.landing && query.data === false) { // We can also use <Navigate /> component to handle these cases
            push(appPaths.auth);
        }

    }, [query.data])

    if (query.isFetching) {
        return <p>Loading...</p>
    }

    return <>{children}</>
}