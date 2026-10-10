import { cityNumberPadding, buildProposedName, findExistingInvader } from '../features/map/components/CreateInvaderModal/name'

const names = (...ns: string[]) => ns.map((name) => ({ name }))

describe('cityNumberPadding', () => {
  it('returns 0 for an empty city', () => {
    expect(cityNumberPadding('', names('PA_0001'))).toBe(0)
  })

  it('returns 0 when the city has no existing invaders', () => {
    expect(cityNumberPadding('LDN', names('PA_0001'))).toBe(0)
  })

  it('detects the zero-padding width from existing padded names', () => {
    expect(cityNumberPadding('PA', names('PA_0001', 'PA_0002'))).toBe(4)
  })

  it('is case-insensitive on the city', () => {
    expect(cityNumberPadding('pa', names('PA_0123'))).toBe(4)
  })

  it('returns 0 when existing names are not zero-padded', () => {
    expect(cityNumberPadding('PA', names('PA_5', 'PA_12'))).toBe(0)
  })

  it('ignores names without a number part', () => {
    expect(cityNumberPadding('PA', names('PA'))).toBe(0)
  })
})

describe('buildProposedName', () => {
  it('applies detected padding to the number', () => {
    expect(buildProposedName('pa', '7', 4)).toBe('PA_0007')
  })

  it('leaves the number untouched with no padding', () => {
    expect(buildProposedName('PA', '7', 0)).toBe('PA_7')
  })

  it('omits the separator when only a city is given', () => {
    expect(buildProposedName('PA', '', 4)).toBe('PA')
  })

  it('returns an empty string when nothing is entered', () => {
    expect(buildProposedName('', '', 0)).toBe('')
  })

  it('trims and uppercases the city', () => {
    expect(buildProposedName('  ldn ', '42', 0)).toBe('LDN_42')
  })
})

describe('findExistingInvader', () => {
  const known = names('PA_0010', 'LYO_3', 'SPACE2ISS')

  it('finds the invader whatever the zero padding or case', () => {
    expect(findExistingInvader('pa', '10', known)?.name).toBe('PA_0010')
    expect(findExistingInvader('PA', '010', known)?.name).toBe('PA_0010')
    expect(findExistingInvader('LYO', '03', known)?.name).toBe('LYO_3')
  })

  it('returns undefined for another invader or an incomplete name', () => {
    expect(findExistingInvader('PA', '100', known)).toBeUndefined()
    expect(findExistingInvader('PAR', '10', known)).toBeUndefined()
    expect(findExistingInvader('PA', '', known)).toBeUndefined()
    expect(findExistingInvader('', '10', known)).toBeUndefined()
  })
})
