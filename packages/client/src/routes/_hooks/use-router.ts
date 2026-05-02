import { useCallback } from "react";
import { useNavigate } from "react-router";

export default function useRouter() {
    const navigate = useNavigate();
    return {
        push : useCallback((path : string) => {
            navigate(path)
        }, []) 
        // More functions can be added here
    }
}