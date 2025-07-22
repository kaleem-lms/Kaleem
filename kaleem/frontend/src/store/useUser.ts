import type { Dispatch, SetStateAction } from 'react';
import { create } from 'zustand';
import type { User } from '@/types';

type Store = {
	user: User | null;
	setUser: Dispatch<SetStateAction<Store['user']>>;
};

const useUser = create<Store>((set) => ({
	user: null,
	setUser: (user) => set({ user: user as Store['user'] }),
}));

export { useUser };
