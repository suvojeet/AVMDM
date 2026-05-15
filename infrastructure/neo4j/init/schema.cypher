// ============================================================
// Averio MDM — Neo4j Schema Initialization
// Run once when setting up a new environment.
// Safe to re-run: all statements use IF NOT EXISTS.
// ============================================================


// ============================================================
// CONSTRAINTS
// ============================================================

// Party
CREATE CONSTRAINT party_globalId     IF NOT EXISTS FOR (p:Party)     REQUIRE p.globalId IS UNIQUE;
CREATE CONSTRAINT party_source       IF NOT EXISTS FOR (p:Party)     REQUIRE (p.sourceSystem, p.sourceSystemId) IS UNIQUE;

// Account
CREATE CONSTRAINT account_globalId   IF NOT EXISTS FOR (a:Account)   REQUIRE a.globalAccountId IS UNIQUE;

// Product
CREATE CONSTRAINT product_globalId   IF NOT EXISTS FOR (p:Product)   REQUIRE p.globalProductId IS UNIQUE;
CREATE CONSTRAINT product_code       IF NOT EXISTS FOR (p:Product)   REQUIRE p.productCode IS UNIQUE;

// Agreement
CREATE CONSTRAINT agreement_globalId IF NOT EXISTS FOR (ag:Agreement) REQUIRE ag.globalAgreementId IS UNIQUE;

// Address
CREATE CONSTRAINT address_id         IF NOT EXISTS FOR (ad:Address)  REQUIRE ad.addressId IS UNIQUE;


// ============================================================
// REGULAR INDEXES
// ============================================================

// Party
CREATE INDEX party_lastName          IF NOT EXISTS FOR (p:Party) ON (p.lastName);
CREATE INDEX party_taxId             IF NOT EXISTS FOR (p:Party) ON (p.taxId);
CREATE INDEX party_ssn               IF NOT EXISTS FOR (p:Party) ON (p.ssn);
CREATE INDEX party_ein               IF NOT EXISTS FOR (p:Party) ON (p.ein);
CREATE INDEX party_duns              IF NOT EXISTS FOR (p:Party) ON (p.dunsNumber);
CREATE INDEX party_lei               IF NOT EXISTS FOR (p:Party) ON (p.lei);
CREATE INDEX party_goldenId          IF NOT EXISTS FOR (p:Party) ON (p.goldenRecordId);
CREATE INDEX party_status            IF NOT EXISTS FOR (p:Party) ON (p.status);
CREATE INDEX party_isGolden          IF NOT EXISTS FOR (p:Party) ON (p.isGolden);
CREATE INDEX party_dateOfBirth       IF NOT EXISTS FOR (p:Party) ON (p.dateOfBirth);
CREATE INDEX party_sourceSystem      IF NOT EXISTS FOR (p:Party) ON (p.sourceSystem);
CREATE INDEX party_partyType         IF NOT EXISTS FOR (p:Party) ON (p.partyType);
CREATE INDEX party_partySubType      IF NOT EXISTS FOR (p:Party) ON (p.partySubType);
CREATE INDEX party_naicsCode         IF NOT EXISTS FOR (p:Party) ON (p.naicsCode);
CREATE INDEX party_countryOfResidence IF NOT EXISTS FOR (p:Party) ON (p.countryOfResidence);
CREATE INDEX party_dataQualityScore  IF NOT EXISTS FOR (p:Party) ON (p.dataQualityScore);
CREATE INDEX party_createdAt         IF NOT EXISTS FOR (p:Party) ON (p.createdAt);

// Account
CREATE INDEX account_status          IF NOT EXISTS FOR (a:Account) ON (a.accountStatus);
CREATE INDEX account_goldenId        IF NOT EXISTS FOR (a:Account) ON (a.goldenRecordId);
CREATE INDEX account_type            IF NOT EXISTS FOR (a:Account) ON (a.accountType);
CREATE INDEX account_isGolden        IF NOT EXISTS FOR (a:Account) ON (a.isGolden);
CREATE INDEX account_sourceSystem    IF NOT EXISTS FOR (a:Account) ON (a.sourceSystem);
CREATE INDEX account_kycStatus       IF NOT EXISTS FOR (a:Account) ON (a.kycStatus);
CREATE INDEX account_amlStatus       IF NOT EXISTS FOR (a:Account) ON (a.amlStatus);
CREATE INDEX account_riskRating      IF NOT EXISTS FOR (a:Account) ON (a.riskRating);
CREATE INDEX account_currency        IF NOT EXISTS FOR (a:Account) ON (a.currency);
CREATE INDEX account_institutionId   IF NOT EXISTS FOR (a:Account) ON (a.institutionId);
CREATE INDEX account_openDate        IF NOT EXISTS FOR (a:Account) ON (a.openDate);

// Product
CREATE INDEX product_status          IF NOT EXISTS FOR (p:Product) ON (p.productStatus);
CREATE INDEX product_goldenId        IF NOT EXISTS FOR (p:Product) ON (p.goldenRecordId);
CREATE INDEX product_type            IF NOT EXISTS FOR (p:Product) ON (p.productType);
CREATE INDEX product_category        IF NOT EXISTS FOR (p:Product) ON (p.productCategory);
CREATE INDEX product_lineOfBusiness  IF NOT EXISTS FOR (p:Product) ON (p.lineOfBusiness);
CREATE INDEX product_isGolden        IF NOT EXISTS FOR (p:Product) ON (p.isGolden);
CREATE INDEX product_sourceSystem    IF NOT EXISTS FOR (p:Product) ON (p.sourceSystem);
CREATE INDEX product_effectiveDate   IF NOT EXISTS FOR (p:Product) ON (p.effectiveStartDate);
CREATE INDEX product_regulatoryClass IF NOT EXISTS FOR (p:Product) ON (p.regulatoryClass);

// Agreement
CREATE INDEX agreement_status        IF NOT EXISTS FOR (ag:Agreement) ON (ag.agreementStatus);
CREATE INDEX agreement_goldenId      IF NOT EXISTS FOR (ag:Agreement) ON (ag.goldenRecordId);
CREATE INDEX agreement_type          IF NOT EXISTS FOR (ag:Agreement) ON (ag.agreementType);
CREATE INDEX agreement_primaryParty  IF NOT EXISTS FOR (ag:Agreement) ON (ag.primaryPartyId);
CREATE INDEX agreement_counterParty  IF NOT EXISTS FOR (ag:Agreement) ON (ag.counterPartyId);
CREATE INDEX agreement_effectiveStart IF NOT EXISTS FOR (ag:Agreement) ON (ag.effectiveStartDate);
CREATE INDEX agreement_effectiveEnd  IF NOT EXISTS FOR (ag:Agreement) ON (ag.effectiveEndDate);
CREATE INDEX agreement_sourceSystem  IF NOT EXISTS FOR (ag:Agreement) ON (ag.sourceSystem);
CREATE INDEX agreement_isGolden      IF NOT EXISTS FOR (ag:Agreement) ON (ag.isGolden);

// Address
CREATE INDEX address_postalCode      IF NOT EXISTS FOR (ad:Address) ON (ad.postalCode);
CREATE INDEX address_city            IF NOT EXISTS FOR (ad:Address) ON (ad.city);
CREATE INDEX address_country         IF NOT EXISTS FOR (ad:Address) ON (ad.country);
CREATE INDEX address_isVerified      IF NOT EXISTS FOR (ad:Address) ON (ad.isVerified);
CREATE INDEX address_type            IF NOT EXISTS FOR (ad:Address) ON (ad.addressType);
CREATE INDEX address_isPrimary       IF NOT EXISTS FOR (ad:Address) ON (ad.isPrimary);


// ============================================================
// COMPOSITE INDEXES
// ============================================================

CREATE INDEX party_golden_status     IF NOT EXISTS FOR (p:Party)    ON (p.isGolden, p.status);
CREATE INDEX party_type_status       IF NOT EXISTS FOR (p:Party)    ON (p.partyType, p.status);
CREATE INDEX party_name_type         IF NOT EXISTS FOR (p:Party)    ON (p.lastName, p.partyType);
CREATE INDEX account_golden_status   IF NOT EXISTS FOR (a:Account)  ON (a.isGolden, a.accountStatus);
CREATE INDEX account_type_status     IF NOT EXISTS FOR (a:Account)  ON (a.accountType, a.accountStatus);
CREATE INDEX product_golden_status   IF NOT EXISTS FOR (p:Product)  ON (p.isGolden, p.productStatus);
CREATE INDEX agreement_golden_status IF NOT EXISTS FOR (ag:Agreement) ON (ag.isGolden, ag.agreementStatus);


// ============================================================
// FULL-TEXT INDEXES
// ============================================================

CREATE FULLTEXT INDEX party_fulltext IF NOT EXISTS
  FOR (p:Party)
  ON EACH [p.firstName, p.lastName, p.fullName, p.organizationName, p.legalName, p.dbaName, p.preferredName];

CREATE FULLTEXT INDEX account_fulltext IF NOT EXISTS
  FOR (a:Account)
  ON EACH [a.accountName, a.accountNumber, a.institutionName];

CREATE FULLTEXT INDEX product_fulltext IF NOT EXISTS
  FOR (p:Product)
  ON EACH [p.productName, p.productCode, p.description, p.productCategory];

CREATE FULLTEXT INDEX agreement_fulltext IF NOT EXISTS
  FOR (ag:Agreement)
  ON EACH [ag.agreementName, ag.agreementNumber, ag.description];

CREATE FULLTEXT INDEX address_fulltext IF NOT EXISTS
  FOR (ad:Address)
  ON EACH [ad.line1, ad.city, ad.stateProvince, ad.postalCode];


// ============================================================
// SEED DATA — Enterprise Demo Dataset
// All MERGEs are idempotent; re-running will update properties.
// ============================================================


// ── Addresses ─────────────────────────────────────────────────────────────

MERGE (addr_jpmc:Address {addressId: "ADDR-JPMC-001"})
SET addr_jpmc += {
  addressType: "BUSINESS", isPrimary: true, isVerified: true,
  verificationSource: "USPS",
  line1: "383 Madison Avenue", city: "New York",
  stateProvince: "NY", postalCode: "10017",
  county: "New York", country: "United States", countryCode: "US",
  latitude: 40.7549, longitude: -73.9741,
  geoAccuracy: "ROOFTOP",
  sourceSystem: "CRM", createdAt: datetime(), updatedAt: datetime()
};

MERGE (addr_bcbs:Address {addressId: "ADDR-BCBS-001"})
SET addr_bcbs += {
  addressType: "BUSINESS", isPrimary: true, isVerified: true,
  verificationSource: "USPS",
  line1: "225 N Michigan Avenue", city: "Chicago",
  stateProvince: "IL", postalCode: "60601",
  county: "Cook", country: "United States", countryCode: "US",
  latitude: 41.8827, longitude: -87.6233,
  geoAccuracy: "ROOFTOP",
  sourceSystem: "ERP", createdAt: datetime(), updatedAt: datetime()
};

MERGE (addr_john:Address {addressId: "ADDR-IND-001"})
SET addr_john += {
  addressType: "HOME", isPrimary: true, isVerified: true,
  verificationSource: "USPS",
  line1: "1234 Oak Street", line2: "Apt 5B",
  city: "Brooklyn", stateProvince: "NY", postalCode: "11201",
  county: "Kings", country: "United States", countryCode: "US",
  latitude: 40.6892, longitude: -73.9898,
  geoAccuracy: "ROOFTOP",
  dpvConfirmation: "Y",
  sourceSystem: "CRM", createdAt: datetime(), updatedAt: datetime()
};

MERGE (addr_jane:Address {addressId: "ADDR-IND-002"})
SET addr_jane += {
  addressType: "HOME", isPrimary: true, isVerified: true,
  verificationSource: "USPS",
  line1: "5678 Maple Avenue", line2: "Unit 12",
  city: "Chicago", stateProvince: "IL", postalCode: "60602",
  county: "Cook", country: "United States", countryCode: "US",
  latitude: 41.8785, longitude: -87.6295,
  geoAccuracy: "ROOFTOP",
  dpvConfirmation: "Y",
  sourceSystem: "CRM", createdAt: datetime(), updatedAt: datetime()
};

MERGE (addr_gs:Address {addressId: "ADDR-GS-001"})
SET addr_gs += {
  addressType: "BUSINESS", isPrimary: true, isVerified: true,
  verificationSource: "USPS",
  line1: "200 West Street", city: "New York",
  stateProvince: "NY", postalCode: "10282",
  county: "New York", country: "United States", countryCode: "US",
  latitude: 40.7135, longitude: -74.0140,
  geoAccuracy: "ROOFTOP",
  sourceSystem: "CRM", createdAt: datetime(), updatedAt: datetime()
};

MERGE (addr_wf:Address {addressId: "ADDR-WF-001"})
SET addr_wf += {
  addressType: "BUSINESS", isPrimary: true, isVerified: true,
  verificationSource: "USPS",
  line1: "420 Montgomery Street", city: "San Francisco",
  stateProvince: "CA", postalCode: "94104",
  county: "San Francisco", country: "United States", countryCode: "US",
  latitude: 37.7929, longitude: -122.4019,
  geoAccuracy: "ROOFTOP",
  sourceSystem: "ERP", createdAt: datetime(), updatedAt: datetime()
};


// ── Parties — Organizations ────────────────────────────────────────────────

MERGE (jpmc:Party {globalId: "GLOB-JPMC-001"})
SET jpmc += {
  partyType: "ORGANIZATION", partySubType: "FINANCIAL_INSTITUTION",
  organizationName: "JPMorgan Chase & Co.",
  legalName: "JPMorgan Chase & Co.",
  taxId: "13-2624428", ein: "13-2624428",
  dunsNumber: "001234567",
  lei: "8I5DZWZKVSZI1NUHU748",
  naicsCode: "522110", sicCode: "6020",
  numberOfEmployees: 293723,
  annualRevenue: 158097000000.0,
  incorporationDate: date("1968-03-22"),
  incorporationCountry: "US",
  countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-JPMC-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-ORG-001",
  dataQualityScore: 0.97, completenessScore: 0.95, confidenceScore: 0.99,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (bcbs:Party {globalId: "GLOB-BCBS-001"})
SET bcbs += {
  partyType: "ORGANIZATION", partySubType: "INSURANCE",
  organizationName: "Blue Cross Blue Shield Association",
  legalName: "Blue Cross Blue Shield Association",
  taxId: "36-2994430", ein: "36-2994430",
  naicsCode: "524114", sicCode: "6321",
  numberOfEmployees: 170000,
  annualRevenue: 119300000000.0,
  incorporationDate: date("1960-06-01"),
  incorporationCountry: "US",
  countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-BCBS-001",
  sourceSystem: "ERP", sourceSystemId: "ERP-ORG-001",
  dataQualityScore: 0.93, completenessScore: 0.90, confidenceScore: 0.98,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (gs:Party {globalId: "GLOB-GS-001"})
SET gs += {
  partyType: "ORGANIZATION", partySubType: "FINANCIAL_INSTITUTION",
  organizationName: "The Goldman Sachs Group, Inc.",
  legalName: "Goldman Sachs Group Inc",
  taxId: "13-4501061", ein: "13-4501061",
  dunsNumber: "002345678",
  lei: "784F5XWPLTWKTBV3E584",
  naicsCode: "523110", sicCode: "6211",
  numberOfEmployees: 49100,
  annualRevenue: 45986000000.0,
  incorporationDate: date("1999-07-21"),
  incorporationCountry: "US",
  countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-GS-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-ORG-002",
  dataQualityScore: 0.96, completenessScore: 0.94, confidenceScore: 0.99,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (wf:Party {globalId: "GLOB-WF-001"})
SET wf += {
  partyType: "ORGANIZATION", partySubType: "FINANCIAL_INSTITUTION",
  organizationName: "Wells Fargo & Company",
  legalName: "Wells Fargo & Company",
  taxId: "41-0449260", ein: "41-0449260",
  dunsNumber: "003456789",
  lei: "PBLD0EJDB5FWOLXP3B76",
  naicsCode: "522110", sicCode: "6020",
  numberOfEmployees: 223987,
  annualRevenue: 80772000000.0,
  incorporationDate: date("1929-01-24"),
  incorporationCountry: "US",
  countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-WF-001",
  sourceSystem: "ERP", sourceSystemId: "ERP-ORG-002",
  dataQualityScore: 0.91, completenessScore: 0.88, confidenceScore: 0.97,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── Parties — Individuals ──────────────────────────────────────────────────

MERGE (john:Party {globalId: "GLOB-IND-001"})
SET john += {
  partyType: "INDIVIDUAL", partySubType: "CUSTOMER",
  firstName: "John", lastName: "Smith",
  fullName: "John Michael Smith", middleName: "Michael",
  salutation: "Mr.", gender: "MALE",
  dateOfBirth: date("1975-06-15"),
  nationality: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-IND-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-CUST-12345",
  dataQualityScore: 0.88, completenessScore: 0.82, confidenceScore: 0.92,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (jane:Party {globalId: "GLOB-IND-002"})
SET jane += {
  partyType: "INDIVIDUAL", partySubType: "CUSTOMER",
  firstName: "Jane", lastName: "Doe",
  fullName: "Jane Elizabeth Doe", middleName: "Elizabeth",
  salutation: "Ms.", gender: "FEMALE",
  dateOfBirth: date("1983-11-28"),
  nationality: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-IND-002",
  sourceSystem: "CRM", sourceSystemId: "CRM-CUST-67890",
  dataQualityScore: 0.85, completenessScore: 0.80, confidenceScore: 0.90,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (sarah:Party {globalId: "GLOB-EMP-001"})
SET sarah += {
  partyType: "INDIVIDUAL", partySubType: "EMPLOYEE",
  firstName: "Sarah", lastName: "Johnson",
  fullName: "Sarah Anne Johnson", middleName: "Anne",
  salutation: "Ms.", gender: "FEMALE",
  dateOfBirth: date("1990-03-07"),
  nationality: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-EMP-001",
  sourceSystem: "HR_SYSTEM", sourceSystemId: "HR-EMP-001",
  dataQualityScore: 0.92, completenessScore: 0.88, confidenceScore: 0.95,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (michael:Party {globalId: "GLOB-IND-003"})
SET michael += {
  partyType: "INDIVIDUAL", partySubType: "PROSPECT",
  firstName: "Michael", lastName: "Chen",
  fullName: "Michael Wei Chen", middleName: "Wei",
  salutation: "Mr.", gender: "MALE",
  dateOfBirth: date("1968-08-19"),
  nationality: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: false,
  goldenRecordId: "GR-IND-003",
  sourceSystem: "MARKETING", sourceSystemId: "MKT-LEAD-54321",
  dataQualityScore: 0.72, completenessScore: 0.65, confidenceScore: 0.78,
  version: 1,
  createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── Party → Address Relationships ─────────────────────────────────────────

MATCH (p:Party {globalId: "GLOB-JPMC-001"}), (a:Address {addressId: "ADDR-JPMC-001"})
MERGE (p)-[:HAS_ADDRESS {isPrimary: true, effectiveStartDate: date("1968-03-22")}]->(a);

MATCH (p:Party {globalId: "GLOB-BCBS-001"}), (a:Address {addressId: "ADDR-BCBS-001"})
MERGE (p)-[:HAS_ADDRESS {isPrimary: true, effectiveStartDate: date("1960-06-01")}]->(a);

MATCH (p:Party {globalId: "GLOB-GS-001"}), (a:Address {addressId: "ADDR-GS-001"})
MERGE (p)-[:HAS_ADDRESS {isPrimary: true, effectiveStartDate: date("1999-07-21")}]->(a);

MATCH (p:Party {globalId: "GLOB-WF-001"}), (a:Address {addressId: "ADDR-WF-001"})
MERGE (p)-[:HAS_ADDRESS {isPrimary: true, effectiveStartDate: date("1929-01-24")}]->(a);

MATCH (p:Party {globalId: "GLOB-IND-001"}), (a:Address {addressId: "ADDR-IND-001"})
MERGE (p)-[:HAS_ADDRESS {isPrimary: true, effectiveStartDate: date("2018-05-01")}]->(a);

MATCH (p:Party {globalId: "GLOB-IND-002"}), (a:Address {addressId: "ADDR-IND-002"})
MERGE (p)-[:HAS_ADDRESS {isPrimary: true, effectiveStartDate: date("2020-02-15")}]->(a);


// ── Party → Party Relationships ───────────────────────────────────────────

MATCH (j:Party {globalId: "GLOB-IND-001"}), (o:Party {globalId: "GLOB-JPMC-001"})
MERGE (j)-[:RELATED_TO {
  relationshipType: "CUSTOMER_OF",
  status: "ACTIVE",
  startDate: date("2010-03-15"),
  isPrimary: true, isVerified: true,
  sourceSystem: "CRM", createdAt: datetime()
}]->(o);

MATCH (j:Party {globalId: "GLOB-IND-002"}), (o:Party {globalId: "GLOB-BCBS-001"})
MERGE (j)-[:RELATED_TO {
  relationshipType: "INSURED_BY",
  status: "ACTIVE",
  startDate: date("2019-01-01"),
  isPrimary: true, isVerified: true,
  sourceSystem: "ERP", createdAt: datetime()
}]->(o);

MATCH (s:Party {globalId: "GLOB-EMP-001"}), (o:Party {globalId: "GLOB-JPMC-001"})
MERGE (s)-[:RELATED_TO {
  relationshipType: "EMPLOYED_BY",
  status: "ACTIVE",
  startDate: date("2015-07-12"),
  isPrimary: true, isVerified: true,
  sourceSystem: "HR_SYSTEM", createdAt: datetime()
}]->(o);

MATCH (o1:Party {globalId: "GLOB-JPMC-001"}), (o2:Party {globalId: "GLOB-BCBS-001"})
MERGE (o1)-[:RELATED_TO {
  relationshipType: "BUSINESS_PARTNER",
  status: "ACTIVE",
  startDate: date("2005-01-01"),
  isPrimary: true, isVerified: true,
  sourceSystem: "CRM", createdAt: datetime()
}]->(o2);

MATCH (o1:Party {globalId: "GLOB-JPMC-001"}), (o2:Party {globalId: "GLOB-GS-001"})
MERGE (o1)-[:RELATED_TO {
  relationshipType: "CORRESPONDENT_BANK",
  status: "ACTIVE",
  startDate: date("1998-06-01"),
  isPrimary: false, isVerified: true,
  sourceSystem: "CORE_BANKING", createdAt: datetime()
}]->(o2);

MATCH (o1:Party {globalId: "GLOB-JPMC-001"}), (o2:Party {globalId: "GLOB-WF-001"})
MERGE (o1)-[:RELATED_TO {
  relationshipType: "INDUSTRY_PEER",
  status: "ACTIVE",
  startDate: date("2001-01-01"),
  isPrimary: false, isVerified: true,
  sourceSystem: "CRM", createdAt: datetime()
}]->(o2);

MATCH (m:Party {globalId: "GLOB-IND-003"}), (j:Party {globalId: "GLOB-JPMC-001"})
MERGE (m)-[:RELATED_TO {
  relationshipType: "PROSPECT_OF",
  status: "ACTIVE",
  startDate: date("2024-11-01"),
  isPrimary: true, isVerified: false,
  sourceSystem: "MARKETING", createdAt: datetime()
}]->(j);


// ── Products ──────────────────────────────────────────────────────────────

MERGE (prod1:Product {globalProductId: "PROD-JPMC-001"})
SET prod1 += {
  productCode: "JPMC-PREM-CHK",
  productName: "JPMorgan Premier Checking",
  productType: "DEPOSIT", productSubType: "CHECKING",
  productCategory: "RETAIL_BANKING",
  productStatus: "ACTIVE",
  description: "Premium checking account with no monthly fees for qualifying customers",
  listPrice: 25.00, currency: "USD",
  pricingModel: "MONTHLY_FEE",
  billingFrequency: "MONTHLY",
  effectiveStartDate: date("2010-01-01"),
  lineOfBusiness: "CONSUMER_BANKING",
  regulatoryClass: "FDIC_INSURED",
  riskCategory: "LOW",
  isBundle: false,
  sourceSystem: "PRODUCT_CATALOG", sourceSystemId: "PC-CHK-001",
  isGolden: true, goldenRecordId: "GR-PROD-001",
  dataQualityScore: 0.98,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (prod2:Product {globalProductId: "PROD-JPMC-002"})
SET prod2 += {
  productCode: "JPMC-SAPH-RESV",
  productName: "Chase Sapphire Reserve",
  productType: "CREDIT", productSubType: "CREDIT_CARD",
  productCategory: "PREMIUM_CARD",
  productStatus: "ACTIVE",
  description: "Premium travel rewards credit card with $300 annual travel credit",
  listPrice: 550.00, currency: "USD",
  pricingModel: "ANNUAL_FEE",
  billingFrequency: "ANNUALLY",
  effectiveStartDate: date("2016-08-21"),
  lineOfBusiness: "CARD_SERVICES",
  regulatoryClass: "CONSUMER_CREDIT",
  riskCategory: "MEDIUM",
  isBundle: false,
  sourceSystem: "PRODUCT_CATALOG", sourceSystemId: "PC-CC-001",
  isGolden: true, goldenRecordId: "GR-PROD-002",
  dataQualityScore: 0.99,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (prod3:Product {globalProductId: "PROD-JPMC-003"})
SET prod3 += {
  productCode: "JPMC-COMM-LEND",
  productName: "JPMorgan Commercial Lending",
  productType: "LOAN", productSubType: "COMMERCIAL_LOAN",
  productCategory: "CORPORATE_BANKING",
  productStatus: "ACTIVE",
  description: "Flexible commercial lending solutions for mid-to-large enterprises",
  pricingModel: "VARIABLE_RATE",
  billingFrequency: "QUARTERLY",
  effectiveStartDate: date("2005-03-01"),
  lineOfBusiness: "COMMERCIAL_BANKING",
  regulatoryClass: "COMMERCIAL_CREDIT",
  riskCategory: "HIGH",
  isBundle: false,
  sourceSystem: "PRODUCT_CATALOG", sourceSystemId: "PC-LN-001",
  isGolden: true, goldenRecordId: "GR-PROD-003",
  dataQualityScore: 0.95,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (prod4:Product {globalProductId: "PROD-BCBS-001"})
SET prod4 += {
  productCode: "BCBS-PPO-PREM",
  productName: "BCBS Blue Preferred PPO",
  productType: "INSURANCE", productSubType: "HEALTH_INSURANCE",
  productCategory: "GROUP_HEALTH",
  productStatus: "ACTIVE",
  description: "Preferred Provider Organization health plan with nationwide network access",
  listPrice: 850.00, currency: "USD",
  pricingModel: "MONTHLY_PREMIUM",
  billingFrequency: "MONTHLY",
  effectiveStartDate: date("2018-01-01"),
  lineOfBusiness: "HEALTH_BENEFITS",
  regulatoryClass: "ACA_COMPLIANT",
  riskCategory: "MEDIUM",
  isBundle: false,
  sourceSystem: "BENEFITS_CATALOG", sourceSystemId: "BC-HLTH-001",
  isGolden: true, goldenRecordId: "GR-PROD-004",
  dataQualityScore: 0.97,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (prod5:Product {globalProductId: "PROD-BCBS-002"})
SET prod5 += {
  productCode: "BCBS-DENT-SELECT",
  productName: "BCBS BlueDental Select",
  productType: "INSURANCE", productSubType: "DENTAL_INSURANCE",
  productCategory: "DENTAL_BENEFITS",
  productStatus: "ACTIVE",
  description: "Comprehensive dental coverage including preventive, basic, and major services",
  listPrice: 45.00, currency: "USD",
  pricingModel: "MONTHLY_PREMIUM",
  billingFrequency: "MONTHLY",
  effectiveStartDate: date("2020-01-01"),
  lineOfBusiness: "DENTAL_BENEFITS",
  regulatoryClass: "DENTAL_PLAN",
  riskCategory: "LOW",
  isBundle: false,
  sourceSystem: "BENEFITS_CATALOG", sourceSystemId: "BC-DENT-001",
  isGolden: true, goldenRecordId: "GR-PROD-005",
  dataQualityScore: 0.96,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (prod6:Product {globalProductId: "PROD-BCBS-003"})
SET prod6 += {
  productCode: "BCBS-HLTH-BUNDLE",
  productName: "BCBS Health & Dental Bundle",
  productType: "INSURANCE", productSubType: "BUNDLED_BENEFITS",
  productCategory: "EMPLOYEE_BENEFITS",
  productStatus: "ACTIVE",
  description: "Combined health and dental insurance bundle at a discounted rate",
  listPrice: 880.00, currency: "USD",
  pricingModel: "MONTHLY_PREMIUM",
  billingFrequency: "MONTHLY",
  effectiveStartDate: date("2021-01-01"),
  lineOfBusiness: "HEALTH_BENEFITS",
  regulatoryClass: "ACA_COMPLIANT",
  riskCategory: "MEDIUM",
  isBundle: true,
  sourceSystem: "BENEFITS_CATALOG", sourceSystemId: "BC-BNDL-001",
  isGolden: true, goldenRecordId: "GR-PROD-006",
  dataQualityScore: 0.95,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

// Product bundle relationship
MATCH (bundle:Product {globalProductId: "PROD-BCBS-003"})
MATCH (health:Product {globalProductId: "PROD-BCBS-001"})
MATCH (dental:Product {globalProductId: "PROD-BCBS-002"})
MERGE (bundle)-[:BUNDLED_WITH {includedSince: date("2021-01-01")}]->(health)
MERGE (bundle)-[:BUNDLED_WITH {includedSince: date("2021-01-01")}]->(dental);


// ── Accounts ──────────────────────────────────────────────────────────────

MERGE (acc1:Account {globalAccountId: "GACC-001"})
SET acc1 += {
  accountNumber: "****4521",
  accountType: "CHECKING", accountSubType: "PREMIER",
  accountName: "John Smith Premier Checking",
  accountStatus: "OPEN", currency: "USD",
  balance: 24350.00, openDate: date("2010-03-15"),
  lastTransactionDate: date("2026-05-14"),
  routingNumber: "021000021",
  institutionName: "JPMorgan Chase Bank, N.A.",
  institutionId: "JPMC-BANK-001",
  branchCode: "NYC-MADISON",
  riskRating: "LOW",
  kycStatus: "VERIFIED", amlStatus: "CLEAR",
  regulatoryCategory: "FDIC_INSURED",
  isGolden: true, goldenRecordId: "GR-ACC-001",
  sourceSystem: "CORE_BANKING", sourceSystemId: "CB-ACC-4521",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (acc2:Account {globalAccountId: "GACC-002"})
SET acc2 += {
  accountNumber: "****8873",
  accountType: "SAVINGS", accountSubType: "HIGH_YIELD",
  accountName: "John Smith High Yield Savings",
  accountStatus: "OPEN", currency: "USD",
  balance: 87600.00, interestRate: 0.0450,
  openDate: date("2015-09-20"),
  lastTransactionDate: date("2026-04-30"),
  routingNumber: "021000021",
  institutionName: "JPMorgan Chase Bank, N.A.",
  institutionId: "JPMC-BANK-001",
  riskRating: "LOW",
  kycStatus: "VERIFIED", amlStatus: "CLEAR",
  regulatoryCategory: "FDIC_INSURED",
  isGolden: true, goldenRecordId: "GR-ACC-002",
  sourceSystem: "CORE_BANKING", sourceSystemId: "CB-SAV-8873",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (acc3:Account {globalAccountId: "GACC-003"})
SET acc3 += {
  accountNumber: "****2290",
  accountType: "CREDIT", accountSubType: "CREDIT_CARD",
  accountName: "Jane Doe Chase Sapphire Reserve",
  accountStatus: "OPEN", currency: "USD",
  balance: -3420.75, creditLimit: 25000.00,
  availableCredit: 21579.25, interestRate: 0.2249,
  openDate: date("2021-04-10"),
  lastTransactionDate: date("2026-05-13"),
  institutionName: "JPMorgan Chase Bank, N.A.",
  institutionId: "JPMC-BANK-001",
  riskRating: "LOW",
  kycStatus: "VERIFIED", amlStatus: "CLEAR",
  regulatoryCategory: "CONSUMER_CREDIT",
  isGolden: true, goldenRecordId: "GR-ACC-003",
  sourceSystem: "CARD_SERVICES", sourceSystemId: "CS-CC-2290",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (acc4:Account {globalAccountId: "GACC-004"})
SET acc4 += {
  accountNumber: "****7741",
  accountType: "HEALTH", accountSubType: "HSA",
  accountName: "Jane Doe Health Savings Account",
  accountStatus: "OPEN", currency: "USD",
  balance: 4200.00,
  openDate: date("2022-01-01"),
  institutionName: "Blue Cross Blue Shield",
  institutionId: "BCBS-ADMIN-001",
  riskRating: "LOW",
  kycStatus: "VERIFIED",
  regulatoryCategory: "HSA_QUALIFIED",
  isGolden: true, goldenRecordId: "GR-ACC-004",
  sourceSystem: "BENEFITS_ADMIN", sourceSystemId: "BA-HSA-7741",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (acc5:Account {globalAccountId: "GACC-005"})
SET acc5 += {
  accountNumber: "****3392",
  accountType: "COMMERCIAL", accountSubType: "CORPORATE_CHECKING",
  accountName: "Goldman Sachs Corporate Operating Account",
  accountStatus: "OPEN", currency: "USD",
  balance: 450000000.00,
  openDate: date("2000-01-15"),
  lastTransactionDate: date("2026-05-14"),
  routingNumber: "021000021",
  institutionName: "JPMorgan Chase Bank, N.A.",
  institutionId: "JPMC-BANK-001",
  branchCode: "NYC-WALLST",
  riskRating: "MEDIUM",
  kycStatus: "VERIFIED", amlStatus: "CLEAR",
  regulatoryCategory: "COMMERCIAL_BANKING",
  isGolden: true, goldenRecordId: "GR-ACC-005",
  sourceSystem: "CORE_BANKING", sourceSystemId: "CB-CORP-3392",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── Party → Account Relationships ─────────────────────────────────────────

MATCH (p:Party {globalId: "GLOB-IND-001"}), (a:Account {globalAccountId: "GACC-001"})
MERGE (p)-[:HAS_ACCOUNT {isPrimary: true, role: "PRIMARY_OWNER"}]->(a);

MATCH (p:Party {globalId: "GLOB-IND-001"}), (a:Account {globalAccountId: "GACC-002"})
MERGE (p)-[:HAS_ACCOUNT {isPrimary: false, role: "PRIMARY_OWNER"}]->(a);

MATCH (p:Party {globalId: "GLOB-IND-002"}), (a:Account {globalAccountId: "GACC-003"})
MERGE (p)-[:HAS_ACCOUNT {isPrimary: true, role: "PRIMARY_OWNER"}]->(a);

MATCH (p:Party {globalId: "GLOB-IND-002"}), (a:Account {globalAccountId: "GACC-004"})
MERGE (p)-[:HAS_ACCOUNT {isPrimary: true, role: "BENEFICIARY"}]->(a);

MATCH (p:Party {globalId: "GLOB-GS-001"}), (a:Account {globalAccountId: "GACC-005"})
MERGE (p)-[:HAS_ACCOUNT {isPrimary: true, role: "CORPORATE_ACCOUNT_HOLDER"}]->(a);


// ── Account → Product Relationships ───────────────────────────────────────

MATCH (a:Account {globalAccountId: "GACC-001"}), (p:Product {globalProductId: "PROD-JPMC-001"})
MERGE (a)-[:HAS_PRODUCT {enrolledDate: date("2010-03-15"), isActive: true}]->(p);

MATCH (a:Account {globalAccountId: "GACC-003"}), (p:Product {globalProductId: "PROD-JPMC-002"})
MERGE (a)-[:HAS_PRODUCT {enrolledDate: date("2021-04-10"), isActive: true}]->(p);

MATCH (a:Account {globalAccountId: "GACC-004"}), (p:Product {globalProductId: "PROD-BCBS-001"})
MERGE (a)-[:HAS_PRODUCT {enrolledDate: date("2022-01-01"), isActive: true}]->(p);


// ── Agreements ────────────────────────────────────────────────────────────

MERGE (agr1:Agreement {globalAgreementId: "GAGR-001"})
SET agr1 += {
  agreementNumber: "JPMC-ACCT-AGR-2010-001",
  agreementType: "ACCOUNT_AGREEMENT", agreementSubType: "DEPOSIT_AGREEMENT",
  agreementName: "JPMorgan Chase Consumer Deposit Agreement",
  agreementStatus: "ACTIVE",
  description: "Standard terms and conditions for consumer deposit accounts including checking and savings",
  effectiveStartDate: date("2010-03-15"),
  signedDate: date("2010-03-15"),
  renewalDate: date("2027-03-15"),
  contractValue: 0.00, currency: "USD",
  paymentTerms: "N/A",
  primaryPartyId: "GLOB-IND-001",
  counterPartyId: "GLOB-JPMC-001",
  governingLaw: "New York State",
  jurisdiction: "US-NY",
  complianceRequirements: "FDIC, CFPB, BSA/AML",
  sourceSystem: "CORE_BANKING", sourceSystemId: "CB-AGR-2010-001",
  isGolden: true, goldenRecordId: "GR-AGR-001",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (agr2:Agreement {globalAgreementId: "GAGR-002"})
SET agr2 += {
  agreementNumber: "BCBS-ENRL-2022-001",
  agreementType: "INSURANCE_AGREEMENT", agreementSubType: "HEALTH_ENROLLMENT",
  agreementName: "BCBS Health Insurance Enrollment Agreement",
  agreementStatus: "ACTIVE",
  description: "Individual health insurance enrollment agreement for Blue Preferred PPO plan",
  effectiveStartDate: date("2022-01-01"),
  signedDate: date("2021-11-15"),
  effectiveEndDate: date("2026-12-31"),
  renewalDate: date("2026-11-01"),
  contractValue: 10200.00, currency: "USD",
  paymentTerms: "MONTHLY_PREMIUM",
  primaryPartyId: "GLOB-IND-002",
  counterPartyId: "GLOB-BCBS-001",
  governingLaw: "Illinois State",
  jurisdiction: "US-IL",
  complianceRequirements: "ACA, HIPAA, State Insurance Regulations",
  sourceSystem: "BENEFITS_ADMIN", sourceSystemId: "BA-ENRL-2022-001",
  isGolden: true, goldenRecordId: "GR-AGR-002",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (agr3:Agreement {globalAgreementId: "GAGR-003"})
SET agr3 += {
  agreementNumber: "JPMC-GS-CORR-2000-001",
  agreementType: "CORRESPONDENT_BANKING", agreementSubType: "MASTER_CORRESPONDENT",
  agreementName: "Goldman Sachs – JPMorgan Correspondent Banking Master Agreement",
  agreementStatus: "ACTIVE",
  description: "Master agreement governing correspondent banking services between Goldman Sachs and JPMorgan Chase",
  effectiveStartDate: date("2000-01-15"),
  signedDate: date("2000-01-10"),
  contractValue: 500000000.00, currency: "USD",
  paymentTerms: "SETTLEMENT_T_PLUS_1",
  primaryPartyId: "GLOB-GS-001",
  counterPartyId: "GLOB-JPMC-001",
  governingLaw: "New York State",
  jurisdiction: "US-NY",
  complianceRequirements: "BSA/AML, OFAC, Reg W, FINRA",
  documentUrl: "https://docs.averiomdm.org/agreements/JPMC-GS-CORR-2000-001",
  sourceSystem: "LEGAL_CONTRACT_MGMT", sourceSystemId: "LCM-CORR-001",
  isGolden: true, goldenRecordId: "GR-AGR-003",
  version: 3, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (agr4:Agreement {globalAgreementId: "GAGR-004"})
SET agr4 += {
  agreementNumber: "JPMC-BCBS-GRP-2018-001",
  agreementType: "GROUP_BENEFITS", agreementSubType: "EMPLOYEE_HEALTH_BENEFITS",
  agreementName: "JPMorgan Chase Group Health Benefits Agreement with BCBS",
  agreementStatus: "ACTIVE",
  description: "Group health and dental benefits agreement providing coverage for all JPMorgan Chase employees",
  effectiveStartDate: date("2018-01-01"),
  signedDate: date("2017-10-01"),
  renewalDate: date("2026-10-01"),
  contractValue: 2750000000.00, currency: "USD",
  paymentTerms: "MONTHLY_PREMIUM",
  primaryPartyId: "GLOB-JPMC-001",
  counterPartyId: "GLOB-BCBS-001",
  governingLaw: "New York State",
  jurisdiction: "US-NY",
  complianceRequirements: "ERISA, HIPAA, ACA, DOL",
  sourceSystem: "LEGAL_CONTRACT_MGMT", sourceSystemId: "LCM-GRP-001",
  isGolden: true, goldenRecordId: "GR-AGR-004",
  version: 2, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (agr5:Agreement {globalAgreementId: "GAGR-005"})
SET agr5 += {
  agreementNumber: "JPMC-NDA-GS-2024-001",
  agreementType: "NDA", agreementSubType: "MUTUAL_NDA",
  agreementName: "Mutual Non-Disclosure Agreement — JPMC & Goldman Sachs",
  agreementStatus: "ACTIVE",
  description: "Mutual NDA governing exchange of confidential information in connection with potential strategic transactions",
  effectiveStartDate: date("2024-01-15"),
  signedDate: date("2024-01-10"),
  effectiveEndDate: date("2026-01-14"),
  contractValue: 0.00, currency: "USD",
  primaryPartyId: "GLOB-JPMC-001",
  counterPartyId: "GLOB-GS-001",
  governingLaw: "New York State",
  jurisdiction: "US-NY",
  complianceRequirements: "SOX, SEC Disclosure Rules",
  sourceSystem: "LEGAL_CONTRACT_MGMT", sourceSystemId: "LCM-NDA-001",
  isGolden: true, goldenRecordId: "GR-AGR-005",
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── Agreement → Party Relationships ───────────────────────────────────────

MATCH (ag:Agreement {globalAgreementId: "GAGR-001"}), (p:Party {globalId: "GLOB-IND-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "PRIMARY", signedDate: date("2010-03-15")}]->(p);
MATCH (ag:Agreement {globalAgreementId: "GAGR-001"}), (p:Party {globalId: "GLOB-JPMC-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "COUNTERPARTY", signedDate: date("2010-03-15")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-002"}), (p:Party {globalId: "GLOB-IND-002"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "INSURED", signedDate: date("2021-11-15")}]->(p);
MATCH (ag:Agreement {globalAgreementId: "GAGR-002"}), (p:Party {globalId: "GLOB-BCBS-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "INSURER", signedDate: date("2021-11-15")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-003"}), (p:Party {globalId: "GLOB-GS-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "CORRESPONDENT", signedDate: date("2000-01-10")}]->(p);
MATCH (ag:Agreement {globalAgreementId: "GAGR-003"}), (p:Party {globalId: "GLOB-JPMC-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "RESPONDENT", signedDate: date("2000-01-10")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-004"}), (p:Party {globalId: "GLOB-JPMC-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "EMPLOYER_SPONSOR", signedDate: date("2017-10-01")}]->(p);
MATCH (ag:Agreement {globalAgreementId: "GAGR-004"}), (p:Party {globalId: "GLOB-BCBS-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "INSURER", signedDate: date("2017-10-01")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-005"}), (p:Party {globalId: "GLOB-JPMC-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "PARTY_A", signedDate: date("2024-01-10")}]->(p);
MATCH (ag:Agreement {globalAgreementId: "GAGR-005"}), (p:Party {globalId: "GLOB-GS-001"})
MERGE (ag)-[:AGREEMENT_PARTY {role: "PARTY_B", signedDate: date("2024-01-10")}]->(p);


// ── Agreement → Account Relationships ─────────────────────────────────────

MATCH (ag:Agreement {globalAgreementId: "GAGR-001"}), (a:Account {globalAccountId: "GACC-001"})
MERGE (ag)-[:LINKED_ACCOUNT {linkedDate: date("2010-03-15"), isPrimary: true}]->(a);
MATCH (ag:Agreement {globalAgreementId: "GAGR-001"}), (a:Account {globalAccountId: "GACC-002"})
MERGE (ag)-[:LINKED_ACCOUNT {linkedDate: date("2015-09-20"), isPrimary: false}]->(a);

MATCH (ag:Agreement {globalAgreementId: "GAGR-002"}), (a:Account {globalAccountId: "GACC-004"})
MERGE (ag)-[:LINKED_ACCOUNT {linkedDate: date("2022-01-01"), isPrimary: true}]->(a);

MATCH (ag:Agreement {globalAgreementId: "GAGR-003"}), (a:Account {globalAccountId: "GACC-005"})
MERGE (ag)-[:LINKED_ACCOUNT {linkedDate: date("2000-01-15"), isPrimary: true}]->(a);


// ── Agreement → Product Relationships ─────────────────────────────────────

MATCH (ag:Agreement {globalAgreementId: "GAGR-001"}), (p:Product {globalProductId: "PROD-JPMC-001"})
MERGE (ag)-[:COVERS_PRODUCT {coveredSince: date("2010-03-15")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-002"}), (p:Product {globalProductId: "PROD-BCBS-001"})
MERGE (ag)-[:COVERS_PRODUCT {coveredSince: date("2022-01-01")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-004"}), (p:Product {globalProductId: "PROD-BCBS-003"})
MERGE (ag)-[:COVERS_PRODUCT {coveredSince: date("2021-01-01")}]->(p);

MATCH (ag:Agreement {globalAgreementId: "GAGR-003"}), (p:Product {globalProductId: "PROD-JPMC-003"})
MERGE (ag)-[:COVERS_PRODUCT {coveredSince: date("2000-01-15")}]->(p);


// ============================================================
// PARTY HIERARCHY — Subsidiary Nodes + PARENT_OF Relationships
// ============================================================

// ── JPMorgan Chase subsidiaries ───────────────────────────────────────────

MERGE (jpmc_cb:Party {globalId: "GLOB-JPMC-CB-001"})
SET jpmc_cb += {
  partyType: "ORGANIZATION", partySubType: "FINANCIAL_INSTITUTION",
  organizationName: "JPMorgan Chase Bank, N.A.",
  legalName: "JPMorgan Chase Bank, National Association",
  taxId: "31-0738296", ein: "31-0738296",
  naicsCode: "522110", sicCode: "6020",
  numberOfEmployees: 189000,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-JPMC-CB-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-SUB-001",
  dataQualityScore: 0.96, completenessScore: 0.93, confidenceScore: 0.99,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (jpmc_ib:Party {globalId: "GLOB-JPMC-IB-001"})
SET jpmc_ib += {
  partyType: "ORGANIZATION", partySubType: "INVESTMENT_BANK",
  organizationName: "J.P. Morgan Securities LLC",
  legalName: "J.P. Morgan Securities LLC",
  taxId: "13-3224016",
  naicsCode: "523110", sicCode: "6211",
  numberOfEmployees: 38000,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-JPMC-IB-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-SUB-002",
  dataQualityScore: 0.95, completenessScore: 0.91, confidenceScore: 0.98,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (jpmc_am:Party {globalId: "GLOB-JPMC-AM-001"})
SET jpmc_am += {
  partyType: "ORGANIZATION", partySubType: "ASSET_MANAGEMENT",
  organizationName: "J.P. Morgan Asset Management",
  legalName: "J.P. Morgan Investment Management Inc.",
  taxId: "13-3100270",
  naicsCode: "523920", sicCode: "6282",
  numberOfEmployees: 14000,
  annualRevenue: 16200000000.0,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-JPMC-AM-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-SUB-003",
  dataQualityScore: 0.94, completenessScore: 0.90, confidenceScore: 0.97,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (jpmc_cc:Party {globalId: "GLOB-JPMC-CC-001"})
SET jpmc_cc += {
  partyType: "ORGANIZATION", partySubType: "CARD_SERVICES",
  organizationName: "Chase Card Services",
  legalName: "Chase Issuance Trust",
  naicsCode: "522210", sicCode: "6141",
  numberOfEmployees: 7500,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-JPMC-CC-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-SUB-004",
  dataQualityScore: 0.93, completenessScore: 0.88, confidenceScore: 0.97,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── BCBS subsidiaries ─────────────────────────────────────────────────────

MERGE (bcbs_il:Party {globalId: "GLOB-BCBS-IL-001"})
SET bcbs_il += {
  partyType: "ORGANIZATION", partySubType: "INSURANCE",
  organizationName: "Blue Cross and Blue Shield of Illinois",
  legalName: "Health Care Service Corporation — Illinois Division",
  taxId: "36-3340536",
  naicsCode: "524114", sicCode: "6321",
  numberOfEmployees: 14000,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-BCBS-IL-001",
  sourceSystem: "ERP", sourceSystemId: "ERP-SUB-001",
  dataQualityScore: 0.92, completenessScore: 0.88, confidenceScore: 0.97,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (bcbs_tx:Party {globalId: "GLOB-BCBS-TX-001"})
SET bcbs_tx += {
  partyType: "ORGANIZATION", partySubType: "INSURANCE",
  organizationName: "Blue Cross and Blue Shield of Texas",
  legalName: "Health Care Service Corporation — Texas Division",
  taxId: "75-1234567",
  naicsCode: "524114", sicCode: "6321",
  numberOfEmployees: 18000,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-BCBS-TX-001",
  sourceSystem: "ERP", sourceSystemId: "ERP-SUB-002",
  dataQualityScore: 0.91, completenessScore: 0.87, confidenceScore: 0.96,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (bcbs_mt:Party {globalId: "GLOB-BCBS-MT-001"})
SET bcbs_mt += {
  partyType: "ORGANIZATION", partySubType: "INSURANCE",
  organizationName: "Blue Cross and Blue Shield of Montana",
  legalName: "Health Care Service Corporation — Montana Division",
  taxId: "81-0234567",
  naicsCode: "524114", sicCode: "6321",
  numberOfEmployees: 1800,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-BCBS-MT-001",
  sourceSystem: "ERP", sourceSystemId: "ERP-SUB-003",
  dataQualityScore: 0.89, completenessScore: 0.85, confidenceScore: 0.94,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── Goldman Sachs subsidiaries ────────────────────────────────────────────

MERGE (gs_llc:Party {globalId: "GLOB-GS-LLC-001"})
SET gs_llc += {
  partyType: "ORGANIZATION", partySubType: "BROKER_DEALER",
  organizationName: "Goldman Sachs & Co. LLC",
  legalName: "Goldman Sachs & Co. LLC",
  taxId: "13-5108538",
  naicsCode: "523110", sicCode: "6211",
  numberOfEmployees: 22000,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-GS-LLC-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-SUB-005",
  dataQualityScore: 0.95, completenessScore: 0.92, confidenceScore: 0.98,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};

MERGE (gs_am:Party {globalId: "GLOB-GS-AM-001"})
SET gs_am += {
  partyType: "ORGANIZATION", partySubType: "ASSET_MANAGEMENT",
  organizationName: "Goldman Sachs Asset Management",
  legalName: "Goldman Sachs Asset Management, L.P.",
  taxId: "13-3920817",
  naicsCode: "523920", sicCode: "6282",
  numberOfEmployees: 9500,
  annualRevenue: 7800000000.0,
  incorporationCountry: "US", countryOfResidence: "US",
  status: "ACTIVE", isGolden: true,
  goldenRecordId: "GR-GS-AM-001",
  sourceSystem: "CRM", sourceSystemId: "CRM-SUB-006",
  dataQualityScore: 0.93, completenessScore: 0.90, confidenceScore: 0.97,
  version: 1, createdBy: "system", updatedBy: "system",
  createdAt: datetime(), updatedAt: datetime()
};


// ── PARENT_OF relationships — JPMorgan Chase ──────────────────────────────

MATCH (parent:Party {globalId: "GLOB-JPMC-001"}), (child:Party {globalId: "GLOB-JPMC-CB-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);

MATCH (parent:Party {globalId: "GLOB-JPMC-001"}), (child:Party {globalId: "GLOB-JPMC-IB-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);

MATCH (parent:Party {globalId: "GLOB-JPMC-001"}), (child:Party {globalId: "GLOB-JPMC-AM-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);

MATCH (parent:Party {globalId: "GLOB-JPMC-CB-001"}), (child:Party {globalId: "GLOB-JPMC-CC-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "DIVISION", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);


// ── PARENT_OF relationships — Blue Cross Blue Shield ─────────────────────

MATCH (parent:Party {globalId: "GLOB-BCBS-001"}), (child:Party {globalId: "GLOB-BCBS-IL-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);

MATCH (parent:Party {globalId: "GLOB-BCBS-001"}), (child:Party {globalId: "GLOB-BCBS-TX-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);

MATCH (parent:Party {globalId: "GLOB-BCBS-001"}), (child:Party {globalId: "GLOB-BCBS-MT-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "GEOGRAPHIC",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);


// ── PARENT_OF relationships — Goldman Sachs ───────────────────────────────

MATCH (parent:Party {globalId: "GLOB-GS-001"}), (child:Party {globalId: "GLOB-GS-LLC-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);

MATCH (parent:Party {globalId: "GLOB-GS-001"}), (child:Party {globalId: "GLOB-GS-AM-001"})
MERGE (parent)-[:PARENT_OF {
  ownershipPercentage: 100.0, hierarchyType: "CORPORATE",
  levelTag: "SUBSIDIARY", status: "ACTIVE",
  createdBy: "system", createdAt: datetime()
}]->(child);


RETURN "Averio MDM schema and seed data initialized successfully — "
     + toString(count{MATCH (n) RETURN n}) + " nodes in graph" AS status;
