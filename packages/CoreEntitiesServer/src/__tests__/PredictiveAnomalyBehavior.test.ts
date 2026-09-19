import { describe, expect, it } from 'vitest';
import { ComputePredictiveAnomalyRiskBand, JournalEntryEntityServer } from '../JournalEntryEntityServer.js';

describe('ComputePredictiveAnomalyRiskBand', () => {
    it('returns null for null, undefined, or NaN', () => {
        expect(ComputePredictiveAnomalyRiskBand(null)).toBeNull();
        expect(ComputePredictiveAnomalyRiskBand(undefined)).toBeNull();
        expect(ComputePredictiveAnomalyRiskBand(NaN)).toBeNull();
    });

    it('classifies probability < 0.10 as Low', () => {
        expect(ComputePredictiveAnomalyRiskBand(0)).toBe('Low');
        expect(ComputePredictiveAnomalyRiskBand(0.05)).toBe('Low');
        expect(ComputePredictiveAnomalyRiskBand(0.0999)).toBe('Low');
    });

    it('classifies probability between 0.10 and 0.25 as Medium', () => {
        expect(ComputePredictiveAnomalyRiskBand(0.10)).toBe('Medium');
        expect(ComputePredictiveAnomalyRiskBand(0.18)).toBe('Medium');
        expect(ComputePredictiveAnomalyRiskBand(0.2499)).toBe('Medium');
    });

    it('classifies probability between 0.25 and 0.50 as High', () => {
        expect(ComputePredictiveAnomalyRiskBand(0.25)).toBe('High');
        expect(ComputePredictiveAnomalyRiskBand(0.35)).toBe('High');
        expect(ComputePredictiveAnomalyRiskBand(0.4999)).toBe('High');
    });

    it('classifies probability >= 0.50 as Critical', () => {
        expect(ComputePredictiveAnomalyRiskBand(0.50)).toBe('Critical');
        expect(ComputePredictiveAnomalyRiskBand(0.75)).toBe('Critical');
        expect(ComputePredictiveAnomalyRiskBand(1.0)).toBe('Critical');
    });
});

describe('JournalEntryEntityServer.syncPredictiveAnomalyFieldsPreSave', () => {
    it('synchronizes risk band when probability is set and risk band is missing', () => {
        const mockJE: {
            PredictedAnomalyProbability: number | null;
            PredictedAnomalyRiskBand: 'Critical' | 'High' | 'Low' | 'Medium' | null;
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedAnomalyProbability: 0.35,
            PredictedAnomalyRiskBand: null,
            GetFieldByName: () => ({ Dirty: false }),
        };

        JournalEntryEntityServer.prototype.syncPredictiveAnomalyFieldsPreSave.call(mockJE);
        expect(mockJE.PredictedAnomalyRiskBand).toBe('High');
    });

    it('synchronizes risk band when probability is dirty even if risk band already exists', () => {
        const mockJE: {
            PredictedAnomalyProbability: number | null;
            PredictedAnomalyRiskBand: 'Critical' | 'High' | 'Low' | 'Medium' | null;
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedAnomalyProbability: 0.65,
            PredictedAnomalyRiskBand: 'Low',
            GetFieldByName: () => ({ Dirty: true }),
        };

        JournalEntryEntityServer.prototype.syncPredictiveAnomalyFieldsPreSave.call(mockJE);
        expect(mockJE.PredictedAnomalyRiskBand).toBe('Critical');
    });

    it('clears risk band when probability is cleared and dirty', () => {
        const mockJE: {
            PredictedAnomalyProbability: number | null;
            PredictedAnomalyRiskBand: 'Critical' | 'High' | 'Low' | 'Medium' | null;
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedAnomalyProbability: null,
            PredictedAnomalyRiskBand: 'High',
            GetFieldByName: () => ({ Dirty: true }),
        };

        JournalEntryEntityServer.prototype.syncPredictiveAnomalyFieldsPreSave.call(mockJE);
        expect(mockJE.PredictedAnomalyRiskBand).toBeNull();
    });

    it('leaves risk band alone when probability is not dirty and risk band is present', () => {
        const mockJE: {
            PredictedAnomalyProbability: number | null;
            PredictedAnomalyRiskBand: 'Critical' | 'High' | 'Low' | 'Medium' | null;
            GetFieldByName: (name: string) => { Dirty: boolean } | null;
        } = {
            PredictedAnomalyProbability: 0.05,
            PredictedAnomalyRiskBand: 'High',
            GetFieldByName: () => ({ Dirty: false }),
        };

        JournalEntryEntityServer.prototype.syncPredictiveAnomalyFieldsPreSave.call(mockJE);
        expect(mockJE.PredictedAnomalyRiskBand).toBe('High');
    });
});
