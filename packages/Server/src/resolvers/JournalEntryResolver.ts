/**
 * JournalEntryResolver — thin GraphQL boundary for JE actions that the Explorer
 * Journal Entry custom form invokes. v1 exposes one mutation:
 *
 *   GenerateJournalEntryReversal → JournalEntryEntityServer.generateReversal(reason, user)
 *
 * Per the MJ Transport-Layer guide the business logic lives in the engine/entity-server
 * (`generateReversal` on `JournalEntryEntityServer` — W6: a NEW Pending JE with Dr/Cr swapped,
 * EntryType='Reversal', back-referenced both ways; never mutates the historical row). This
 * resolver only: (1) extracts the per-request user, (2) loads the JE via the metadata system
 * (which returns the registered `JournalEntryEntityServer` subclass), (3) calls the method,
 * (4) maps the new reversal to a typed result.
 */
import {
  Resolver, Mutation, Arg, Ctx, ObjectType, Field, ID,
  AppContext, ResolverBase,
} from '@memberjunction/server';
import { LogError, Metadata } from '@memberjunction/core';
import { JournalEntryEntityServer } from '@mj-biz-apps/accounting-core-entities-server';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

@ObjectType()
export class GenerateReversalResult {
  @Field() Success: boolean;
  /** The new reversal JE's ID (a Pending JE with Dr/Cr swapped). */
  @Field(() => ID, { nullable: true }) ReversalJournalEntryID?: string;
  /** The new reversal JE's EntryNumber, for the UI to show + link to. */
  @Field({ nullable: true }) ReversalEntryNumber?: string;
  @Field({ nullable: true }) ErrorMessage?: string;
}

@Resolver()
export class JournalEntryResolver extends ResolverBase {
  /** Generate a reversal JE (new Pending entry, Dr/Cr swapped) for a posted/batched JE. */
  @Mutation(() => GenerateReversalResult)
  async GenerateJournalEntryReversal(
    @Arg('journalEntryID', () => ID) journalEntryID: string,
    @Arg('reason', () => String) reason: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<GenerateReversalResult> {
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return { Success: false, ErrorMessage: 'No authenticated user.' };

      const md = new Metadata();
      // GetEntityObject returns the registered JournalEntryEntityServer subclass (which owns generateReversal).
      const je = await md.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, user);
      const loaded = await je.Load(journalEntryID);
      if (!loaded) return { Success: false, ErrorMessage: `Journal Entry ${journalEntryID} not found.` };

      const reversal = await je.generateReversal(reason, user);
      return { Success: true, ReversalJournalEntryID: reversal.ID, ReversalEntryNumber: reversal.EntryNumber };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`GenerateJournalEntryReversal failed: ${msg}`);
      return { Success: false, ErrorMessage: msg };
    }
  }
}
