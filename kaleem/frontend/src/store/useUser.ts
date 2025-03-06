import { User } from "@/types"
import { Dispatch, SetStateAction } from "react"
import { create } from 'zustand'

type Store = {
    user: User | null
    setUser: Dispatch<SetStateAction<Store['user']>>
}


const useUser = create<Store>((set) => (
    {
        user: null,
        setUser: (user) => set({ user: user as Store["user"] }),
    }
))

export { useUser }