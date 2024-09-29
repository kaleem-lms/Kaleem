import { Dispatch, SetStateAction } from "react"
import { create } from 'zustand'

type Store = {
    user: {
        name: string,
        email: string,
        image: string,
    } | null
    setUser: Dispatch<SetStateAction<Store['user']>>
}


const useUser = create<Store>((set) => (
    {
        user: null,
        setUser: (user) => set({ user: user as Store["user"] }),
    }
))

export { useUser }