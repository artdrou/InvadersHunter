import { missingFields, groupIncomplete, requestFields } from '../features/invaders/edit-fields'

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

describe('groupIncomplete', () => {
  const cityOf = (n: string) => n.split('_')[0]
  const inv = (id: number, name: string, over: object = {}) => ({ id, name, ...complete, ...over })
  const invaders = [
    inv(1, 'LAP_50', { latitude: null, longitude: null }),
    inv(2, 'LAP_8', { latitude: null, longitude: null, image_url: null }),
    inv(3, 'BGK_46', { points: null }),
    inv(4, 'PA_1'),                                   // complete: never listed
  ]

  it('groups incomplete invaders by city, cities and numbers in order', () => {
    const { groups } = groupIncomplete(invaders, new Set(), cityOf)
    expect(groups.map((g: any) => [g.city, g.items.map((i: any) => i.invader.name)])).toEqual([
      ['BGK', ['BGK_46']],
      ['LAP', ['LAP_8', 'LAP_50']],
    ])
  })

  it('filters on what is missing (any of the selected fields) and counts every field', () => {
    const { groups, counts } = groupIncomplete(invaders, new Set(['photo', 'points']), cityOf)
    expect(groups.flatMap((g: any) => g.items.map((i: any) => i.invader.name))).toEqual(['BGK_46', 'LAP_8'])
    expect(counts).toEqual({ all: 3, location: 2, photo: 1, points: 1, state: 0, posed: 0 })
  })
})

describe('requestFields', () => {
  it('lists the details a proposal covers', () => {
    expect(requestFields({ proposed_latitude: 65.8, proposed_longitude: 23.1 })).toEqual(['location'])
    expect(requestFields({ proposed_state: 'Destroyed', proposed_points: 30, proposed_date_pose: '2026-01-01' }))
      .toEqual(['points', 'state', 'posed'])
    expect(requestFields({ proposed_image_url: 'https://r2/x.jpg' })).toEqual(['photo'])
    expect(requestFields({})).toEqual([])
  })
})
