import { CompositeKey } from '@memberjunction/core';

/**
 * The key a just-created record was WRITTEN under.
 *
 * Read it from `PrimaryKey`, never from `.ID` / `Get('ID')`, for an IsA child such as Accounting
 * Company Profile (IsA MJ: Companies). `.ID` reads the PARENT's key. On MJ 6.1.x a create over GraphQL
 * never sends that key: the server mints its own and writes every row under it, the parent keeps the
 * browser's unwritten key, and the server's value is dropped on the way back because a ReadOnly field
 * takes one write. `PrimaryKey` reads the child's own key field, which the save response carries.
 * Once MJ sends the key on create, both reads agree.
 *
 * @returns the written key, or null when the record carries none
 */
export function createdRecordId(record: { PrimaryKey: CompositeKey }, fieldName = 'ID'): string | null {
  const value: unknown = record.PrimaryKey.GetValueByFieldName(fieldName);
  return value === null || value === undefined || value === '' ? null : String(value);
}
