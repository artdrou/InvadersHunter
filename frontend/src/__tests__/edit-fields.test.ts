import { missingFields } from '../features/invaders/edit-fields'

const complete = {
  points: 30, state: 'Good', date_pose: '2026-01-10', latitude: 65.58, longitude: 22.15,
  image_url: 'https://x/LAP_50.png',
} as const

describe('missingFields', () => {
  it('is empty for a complete invader', () => {
    expect([...missingFields(complete)]).toEqual([])
  })

  it('lists every missing detail (LAP_50-like: no location)', () => {
    expect([...missingFields({ ...complete, latitude: null, longitude: null })]).toEqual(['location'])
    expect([...missingFields({
      points: null, state: null, date_pose: null, latitude: null, longitude: null, image_url: null,
    })]).toEqual(['points', 'state', 'posed', 'location', 'photo'])
  })

  it('treats an Unknown state as missing', () => {
    expect(missingFields({ ...complete, state: 'Unknown' }).has('state')).toBe(true)
  })
})
