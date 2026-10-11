import { createSingleFlight } from '../services/single-flight'

describe('createSingleFlight', () => {
  it('shares the running task instead of starting another (screens syncing at once)', async () => {
    const flight = createSingleFlight()
    let release!: () => void
    const task = jest.fn(() => new Promise<void>((r) => { release = r }))

    const a = flight.run(task)
    const b = flight.run(task)
    expect(task).toHaveBeenCalledTimes(1)
    expect(b).toBe(a)
    expect(flight.running).toBe(true)

    release()
    await a
    expect(flight.running).toBe(false)
  })

  it('runs again once the previous task is over, even if it failed', async () => {
    const flight = createSingleFlight()
    await expect(flight.run(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline')
    const task = jest.fn(() => Promise.resolve())
    await flight.run(task)
    expect(task).toHaveBeenCalledTimes(1)
  })
})
