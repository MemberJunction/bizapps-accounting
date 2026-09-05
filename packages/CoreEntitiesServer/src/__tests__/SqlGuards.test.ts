/**
 * Unit tests for the shared validate-don't-escape UUID guards (2026-09-05 security sweep).
 * These back every ExtraFilter interpolation of a client-supplied id in this package.
 */
import { describe, it, expect } from 'vitest';
import { isSqlGuid, requireSqlGuid, sqlGuidLiteral } from '../SqlGuards.js';

const GOOD = '48d60bcc-044b-4cc2-9675-0d3b57bcdcba';
const GOOD_UPPER = '48D60BCC-044B-4CC2-9675-0D3B57BCDCBA';

describe('isSqlGuid', () => {
  it('accepts lowercase and uppercase UUIDs (SQL Server returns upper, randomUUID lower)', () => {
    expect(isSqlGuid(GOOD)).toBe(true);
    expect(isSqlGuid(GOOD_UPPER)).toBe(true);
  });

  it('rejects injection payloads, malformed shapes, and non-strings', () => {
    expect(isSqlGuid(`x' OR 1=1--`)).toBe(false);
    expect(isSqlGuid(`${GOOD}' OR '1'='1`)).toBe(false);
    // 36 chars of hex+dashes but not the 8-4-4-4-12 shape (the old loose pattern accepted this)
    expect(isSqlGuid('------------------------------------')).toBe(false);
    expect(isSqlGuid('')).toBe(false);
    expect(isSqlGuid(null)).toBe(false);
    expect(isSqlGuid(undefined)).toBe(false);
    expect(isSqlGuid('GL_1')).toBe(false);
  });
});

describe('requireSqlGuid / sqlGuidLiteral', () => {
  it('passes a valid UUID through and quotes it as a literal', () => {
    expect(requireSqlGuid(GOOD, 'ctx')).toBe(GOOD);
    expect(sqlGuidLiteral(GOOD, 'ctx')).toBe(`'${GOOD}'`);
  });

  it('throws with the caller context on anything else', () => {
    expect(() => requireSqlGuid(`x' OR 1=1--`, 'RecordBatchDecision')).toThrow(/RecordBatchDecision/);
    expect(() => sqlGuidLiteral('not-a-uuid', 'W9')).toThrow(/not a valid UUID/);
  });
});
