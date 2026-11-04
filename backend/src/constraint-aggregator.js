/**
 * Multi-Attribute Constraint Aggregator for MITRA
 *
 * Resolves complex institutional cost calculations across multiple documents:
 * (Tuition Fee Circular + Development Fee + Hostel Fees + Mess Fees + Caution Deposit)
 *
 * Prevents fragmented answers where a student asks for total admission expenses
 * and only receives tuition fees.
 */

import { getDb } from './store.js';

/**
 * Computes an aggregate institutional breakdown for a student given their profile constraints.
 *
 * @param {object} constraints
 * @param {string} constraints.route - 'firstYear' | 'directSecondYear'
 * @param {string} constraints.category - 'open' | 'obc' | 'ebc' | 'ews' | 'sebc' | 'scst' | 'vjnt'
 * @param {string} constraints.gender - 'boy' | 'girl'
 * @param {boolean} constraints.includeHostel - whether to include accommodation
 * @returns {object|null} Aggregate cost breakdown or null if records missing
 */
export function aggregateInstitutionalCost({ route = 'firstYear', category = 'open', gender = 'boy', includeHostel = false } = {}) {
  const db = getDb();
  const knowledge = db?.knowledge || [];

  const feeRecord = knowledge.find(k => k.facts?.kind === 'academicFees' || k.id === 'KB-2');
  const hostelRecord = knowledge.find(k => k.facts?.kind === 'accommodationFees' || k.id === 'KB-3');

  if (!feeRecord?.facts || feeRecord.facts.kind !== 'academicFees') {
    return null;
  }

  const table = feeRecord.facts[route] || feeRecord.facts.firstYear;
  if (!table) return null;

  let academicCategoryKey = 'open';
  const normCat = category.toLowerCase();
  if (['sc', 'st', 'scst'].includes(normCat)) {
    academicCategoryKey = 'scst';
  } else if (['vjnt', 'nt', 'sbc', 'tfws'].includes(normCat)) {
    academicCategoryKey = 'vjnt';
  } else if (['obc', 'ebc', 'ews', 'sebc', 'concession'].includes(normCat)) {
    academicCategoryKey = gender === 'girl' ? 'concessionGirl' : 'concessionBoy';
  }

  const tuitionPayable = Number(table[academicCategoryKey] || table.open || 0);

  const breakdown = {
    academicYear: feeRecord.facts.academicYear || '2025-26',
    route: route === 'directSecondYear' ? 'Direct Second Year (Lateral)' : 'First Year Engineering',
    category: normCat.toUpperCase(),
    gender: gender === 'girl' ? 'Girls' : 'Boys',
    academicFees: {
      tuitionPayable,
      developmentAndExam: 'Included in published total',
      categoryConcessionApplied: academicCategoryKey !== 'open',
    },
    totalPayable: tuitionPayable,
  };

  if (includeHostel && hostelRecord?.facts?.kind === 'accommodationFees') {
    const hFacts = hostelRecord.facts;
    const hostelRent = Number(hFacts.hostel || 0);
    const messCharges = Number(hFacts.messAnnual || 0);
    const cautionDeposit = Number(hFacts.refundableDeposit || 0);

    breakdown.accommodation = {
      hostelAnnualRent: hostelRent,
      messAnnualCharges: messCharges,
      refundableDeposit: cautionDeposit,
      subtotal: hostelRent + messCharges + cautionDeposit,
    };
    breakdown.totalPayable += breakdown.accommodation.subtotal;
  }

  return breakdown;
}
