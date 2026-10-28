import { webImporterUrl, displayUrl } from '../features/flash-import/utils';

describe('webImporterUrl', () => {
  it('uses the public domain for the production backend', () => {
    expect(webImporterUrl('https://invader-hunter-production.up.railway.app'))
      .toBe('https://hintvaders.app/flash-importer');
  });

  it('keeps the Railway URL for dev and staging', () => {
    expect(webImporterUrl('https://invader-hunter-staging.up.railway.app/'))
      .toBe('https://invader-hunter-staging.up.railway.app/flash-importer');
    expect(webImporterUrl('https://invader-hunter-development.up.railway.app'))
      .toBe('https://invader-hunter-development.up.railway.app/flash-importer');
  });

  it('keeps a local backend as is', () => {
    expect(webImporterUrl('http://192.168.1.10:8000')).toBe('http://192.168.1.10:8000/flash-importer');
  });
});

describe('displayUrl', () => {
  it('drops the scheme', () => {
    expect(displayUrl('https://hintvaders.app/flash-importer')).toBe('hintvaders.app/flash-importer');
  });
});
