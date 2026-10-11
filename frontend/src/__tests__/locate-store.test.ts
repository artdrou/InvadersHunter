import { useLocateStore } from '../features/map/store'

describe('useLocateStore', () => {
  beforeEach(() => useLocateStore.getState().setPendingInvader(null))

  it('opens the popup in view mode by default (Locate)', () => {
    useLocateStore.getState().setPendingInvader(12)
    expect(useLocateStore.getState()).toMatchObject({ pendingInvaderId: 12, pendingEdit: false })
  })

  it('can open it straight in the edit form (Update from the list)', () => {
    useLocateStore.getState().setPendingInvader(12, true)
    expect(useLocateStore.getState()).toMatchObject({ pendingInvaderId: 12, pendingEdit: true })
  })

  it('clearing the pending invader also clears the edit flag', () => {
    useLocateStore.getState().setPendingInvader(12, true)
    useLocateStore.getState().setPendingInvader(null, true)
    expect(useLocateStore.getState()).toMatchObject({ pendingInvaderId: null, pendingEdit: false })
  })
})
