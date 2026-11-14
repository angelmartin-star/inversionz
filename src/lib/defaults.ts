import type { InvestmentInput } from "@/types/investment";

/** Caso de ejemplo precargado: piso a reformar en Madrid capital. */
export const EXAMPLE_INPUT: InvestmentInput = {
  property: {
    address: { street: "Calle de Embajadores", number: "120", floor: "3", door: "B" },
    postalCode: "28045", municipality: "Madrid", surfaceM2: 70, condition: "A_REFORMAR",
    purchasePrice: 250_000, cadastralValueTotal: 120_000, cadastralValueLand: 60_000,
  },
  acquisition: {
    renovationCost: 25_000, furnitureCost: 6_000, notaryFees: 900, registryFees: 600, agencyFees: 500,
    buyerAgencyCommission: 0, renovationIsImprovement: true,
  },
  financing: { enabled: true, loanToValue: 0.8, termYears: 30, annualInterestRate: 0.0275, openingFee: 0 },
  rental: {
    monthlyRent: 1_300, rentalType: "VIVIENDA_HABITUAL", vacancyRate: 0.04, annualRentGrowth: 0.02, annualExpenseGrowth: 0.02,
    annualExpenses: { ibi: 450, wasteTax: 140, parkingVado: 0, community: 1_200, homeInsurance: 250, defaultInsurance: 500, maintenance: 600, managementFeePct: 0, other: 0 },
    reduction: "AUTO", reductionFlags: {}, investorGeneralTaxBase: 45_000, investorSavingsTaxBaseInSaleYear: 0,
  },
  sale: { yearsUntilSale: 10, estimatedSalePrice: 340_000, saleCommissionPct: 0.03, otherSaleCosts: 0 },
};

export const STORAGE_KEY = "inversionq:analisis";
