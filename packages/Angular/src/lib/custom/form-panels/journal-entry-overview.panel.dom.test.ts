import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IMetadataProvider, Metadata, UserInfo } from '@memberjunction/core';
import { NavigationService } from '@memberjunction/ng-shared';
import { JournalEntryOverviewPanel } from './journal-entry-overview.panel';
import { BatchOperatorCatalog } from '../../../__tests__/support/batch-operator';

/**
 * The journal entry form's Posting card offers "Build a batch…" on an unbatched entry only to holders
 * of the batch-operator grant (#448), the Finance role's Authorization the server's Build requires.
 * The card's own layout is not under test, so the template is replaced; its gate is read from source.
 */
const USER_ID = '00000000-0000-0000-0000-0000000000a1';

describe('JournalEntryOverviewPanel — "Build a batch…" needs the batch-operator grant (#448)', () => {
  let opened: string[];

  beforeEach(async () => {
    opened = [];
    const nav = { OpenNavItemByName: async (name: string) => { opened.push(name); } };
    await TestBed.configureTestingModule({
      declarations: [JournalEntryOverviewPanel],
      providers: [{ provide: NavigationService, useValue: nav }],
    })
      .overrideComponent(JournalEntryOverviewPanel, { set: { template: '' } })
      .compileComponents();
  });

  function signIn(holdsGrant: boolean): void {
    const user = new UserInfo();
    user.ID = USER_ID;
    const provider = { CurrentUser: user, Authorizations: BatchOperatorCatalog(holdsGrant ? [USER_ID] : []) };
    vi.spyOn(Metadata, 'Provider', 'get').mockReturnValue(provider as unknown as IMetadataProvider);
  }

  it('lets a holder go to the batch builder', async () => {
    signIn(true);
    const panel = TestBed.createComponent(JournalEntryOverviewPanel).componentInstance;
    expect(panel.MayBuild).toBe(true);
    await panel.OpenBatchBuilder();
    expect(opened).toEqual(['Batches']);
  });

  it('offers anyone else nothing to build', async () => {
    signIn(false);
    const panel = TestBed.createComponent(JournalEntryOverviewPanel).componentInstance;
    expect(panel.MayBuild).toBe(false);
    await panel.OpenBatchBuilder();
    expect(opened).toEqual([]);
  });

  it('renders the link only inside the MayBuild gate, and the "Not yet batched." hint either way', () => {
    const html = readFileSync(join(__dirname, 'journal-entry-overview.panel.html'), 'utf8');
    expect(html).toMatch(/@if \(MayBuild\) \{\s*<button[^>]*\(click\)="OpenBatchBuilder\(\)"/);
    expect(html).toMatch(/\}\s*<span class="mja-je-ov-fact__hint">Not yet batched\.<\/span>/);
  });
});
