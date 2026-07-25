import { Alert } from 'react-native';
import * as MailComposer from 'expo-mail-composer';

import { contactSupport, formatBugReportBody, SUPPORT_EMAIL, type SupportMeta } from '../support';

jest.mock('expo-mail-composer');

const META: SupportMeta = {
  appVersion: '1.0.0',
  buildVersion: '42',
  osName: 'Android',
  osVersion: '14',
  deviceModel: 'Pixel 7',
  language: 'fr',
};
// `t` factice : renvoie la clé, et suffixe les options d'interpolation quand il y en a
// (permet de vérifier que l'adresse est bien transmise au message de fallback).
const t = ((k: string, opts?: Record<string, unknown>) =>
  opts ? `${k} ${JSON.stringify(opts)}` : k) as any;

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

describe('contactSupport', () => {
  afterEach(() => jest.clearAllMocks());

  it('fallback : affiche une Alert avec l’adresse si aucun client mail', async () => {
    (MailComposer.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const res = await contactSupport('contact', t);
    expect(res).toEqual({ fallback: true });
    expect(spy).toHaveBeenCalledWith(
      'help.mailUnavailableTitle',
      expect.stringContaining(SUPPORT_EMAIL),
    );
    expect(MailComposer.composeAsync).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('nominal (bug) : ouvre le mail avec sujet + corps technique', async () => {
    (MailComposer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (MailComposer.composeAsync as jest.Mock).mockResolvedValue({ status: 'sent' });
    const res = await contactSupport('bug', t);
    expect(res).toEqual({ ok: true });
    const options = (MailComposer.composeAsync as jest.Mock).mock.calls[0][0];
    expect(options.recipients).toEqual([SUPPORT_EMAIL]);
    expect(options.subject).toBe('help.bug.subject');
    expect(options.body).toBeDefined();
    expect(options.body).toContain('help.bug.prompt');
  });

  it('nominal (contact) : ouvre le mail sans corps pré-rempli', async () => {
    (MailComposer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (MailComposer.composeAsync as jest.Mock).mockResolvedValue({ status: 'sent' });
    const res = await contactSupport('contact', t);
    expect(res).toEqual({ ok: true });
    const options = (MailComposer.composeAsync as jest.Mock).mock.calls[0][0];
    expect(options.subject).toBe('help.contact.subject');
    expect(options.body).toBeUndefined();
  });
});
