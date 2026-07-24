import { formatBugReportBody, type SupportMeta } from '../support';

const META: SupportMeta = {
  appVersion: '1.0.0',
  buildVersion: '42',
  osName: 'Android',
  osVersion: '14',
  deviceModel: 'Pixel 7',
  language: 'fr',
};
const t = ((k: string) => k) as any;

describe('formatBugReportBody', () => {
  it('inclut les métadonnées et l’invite', () => {
    const body = formatBugReportBody(META, t);
    expect(body).toContain('help.bug.prompt');
    expect(body).toContain('1.0.0');
    expect(body).toContain('42');
    expect(body).toContain('Android 14');
    expect(body).toContain('Pixel 7');
    expect(body).toContain('fr');
  });
  it('est déterministe', () => {
    expect(formatBugReportBody(META, t)).toBe(formatBugReportBody(META, t));
  });
});
