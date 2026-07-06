import { create } from 'zustand';

type AdminPickerStore = {
  pickedCoords: { lat: number; lon: number } | null;
  setPickedCoords: (coords: { lat: number; lon: number } | null) => void;
};

export const useAdminPickerStore = create<AdminPickerStore>((set) => ({
  pickedCoords: null,
  setPickedCoords: (coords) => set({ pickedCoords: coords }),
}));
