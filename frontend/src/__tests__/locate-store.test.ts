import { useLocateStore } from '../features/map/store'

describe('useLocateStore — list ↔ map location picking', () => {
  beforeEach(() => {
    const s = useLocateStore.getState()
    s.setPickForList(null)
    s.setPickedForList(null)
  })

  it('asks the map to open the picker for an invader of the list', () => {
    useLocateStore.getState().setPickForList(12)
    expect(useLocateStore.getState().pickForList).toBe(12)
  })

  it('hands the picked location back to the list, which consumes it', () => {
    useLocateStore.getState().setPickedForList({ invaderId: 12, lat: 65.58, lon: 22.15 })
    expect(useLocateStore.getState().pickedForList).toEqual({ invaderId: 12, lat: 65.58, lon: 22.15 })
    useLocateStore.getState().setPickedForList(null)
    expect(useLocateStore.getState().pickedForList).toBeNull()
  })
})
