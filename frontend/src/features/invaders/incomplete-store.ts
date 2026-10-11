import { create } from "zustand";
import type { EditField } from "./edit-fields";

/** Incomplete-invaders page state, kept while the user picks a location on the map. */
type IncompleteStore = {
  fields: EditField[];          // filter: missing any of these (empty = anything)
  toggleField: (f: EditField) => void;
  clearFields: () => void;
  expandedCities: string[];
  toggleCity: (city: string) => void;
  expandCity: (city: string) => void;
};

export const useIncompleteStore = create<IncompleteStore>()((set) => ({
  fields: [],
  toggleField: (f) => set((s) => ({
    fields: s.fields.includes(f) ? s.fields.filter((x) => x !== f) : [...s.fields, f],
  })),
  clearFields: () => set({ fields: [] }),
  expandedCities: [],
  toggleCity: (city) => set((s) => ({
    expandedCities: s.expandedCities.includes(city)
      ? s.expandedCities.filter((c) => c !== city)
      : [...s.expandedCities, city],
  })),
  expandCity: (city) => set((s) => (
    s.expandedCities.includes(city) ? s : { expandedCities: [...s.expandedCities, city] }
  )),
}));
