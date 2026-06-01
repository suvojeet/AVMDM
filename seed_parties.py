"""
Averio MDM -- Direct Cosmos DB Party Seeder
Creates sample INDIVIDUAL and ORGANIZATION party records in Azure Cosmos DB.
Run: python seed_parties.py
"""

import sys
import uuid
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, PartitionKey, exceptions

# Force UTF-8 output so the console doesn't choke on special chars
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Connection ────────────────────────────────────────────────────────────────
# Set COSMOS_ENDPOINT and COSMOS_KEY as environment variables before running.
# Never hardcode credentials — use: export COSMOS_KEY="<your-primary-key>"
import os
ENDPOINT  = os.environ.get("COSMOS_ENDPOINT", "https://averio-mdmdb.documents.azure.com:443/")
KEY       = os.environ.get("COSMOS_KEY", "")
DATABASE  = os.environ.get("COSMOS_DATABASE", "averiodb")
CONTAINER = os.environ.get("COSMOS_CONTAINER", "parties")

client   = CosmosClient(ENDPOINT, credential=KEY)
database = client.get_database_client(DATABASE)

# Create container without dedicated throughput — uses database-level shared RU/s
try:
    container = database.create_container_if_not_exists(
        id=CONTAINER,
        partition_key=PartitionKey(path="/partyType")
        # no offer_throughput — avoids exceeding the account RU/s cap
    )
    print(f"[OK] Container '{CONTAINER}' ready")
except exceptions.CosmosResourceExistsError:
    container = database.get_container_client(CONTAINER)
    print(f"[OK] Using existing container '{CONTAINER}'")
except Exception as e:
    # Container may still exist even if creation call errored
    container = database.get_container_client(CONTAINER)
    print(f"[..] Container note: {e}")

now = datetime.now(timezone.utc).isoformat()

# ── Individual Party ──────────────────────────────────────────────────────────
individual_id  = str(uuid.uuid4())
individual = {
    "id":              individual_id,
    "globalId":        individual_id,
    "goldenRecordId":  individual_id,
    "partyType":       "INDIVIDUAL",
    "partySubType":    "CUSTOMER",
    "status":          "ACTIVE",

    # Identity
    "salutation":         "Mr.",
    "firstName":          "James",
    "middleName":         "William",
    "lastName":           "Mitchell",
    "fullName":           "James William Mitchell",
    "preferredName":      "Jim",
    "gender":             "MALE",
    "dateOfBirth":        "1978-03-15",
    "nationality":        "American",
    "countryOfResidence": "United States",
    "language":           "en",

    # Identification (masked)
    "ssn":            "***-**-6789",
    "passport":       "P12345678",
    "driversLicense": "TX-DL-4892736",

    # Contact
    "phones": {
        "MOBILE": "+1-512-555-0142",
        "WORK":   "+1-512-555-0200"
    },
    "emails": {
        "PRIMARY": "james.mitchell@email.com",
        "WORK":    "jmitchell@nexusfinancial.com"
    },
    "websites": {},

    # Address
    "addresses": [
        {
            "addressId":          str(uuid.uuid4()),
            "addressType":        "HOME",
            "isPrimary":          True,
            "isVerified":         True,
            "verificationSource": "USPS_DPV",
            "line1":              "842 Lakeview Terrace",
            "city":               "Austin",
            "stateProvince":      "TX",
            "postalCode":         "78701",
            "county":             "Travis",
            "country":            "United States",
            "countryCode":        "US",
            "latitude":           30.2672,
            "longitude":          -97.7431,
            "geoAccuracy":        "ROOFTOP",
            "dpvConfirmation":    "Y",
            "effectiveStartDate": "2019-06-01",
            "sourceSystem":       "CRM_SALESFORCE"
        }
    ],

    # Source system
    "sourceSystem":     "CRM_SALESFORCE",
    "sourceSystemId":   "SF-CONTACT-00Q8Z000001ABCD",
    "sourceLastUpdated": now,

    # Golden record metadata
    "isGolden":                True,
    "matchScore":              1.0,
    "confidenceScore":         0.97,
    "dataQualityScore":        0.94,
    "completenessScore":       0.91,
    "accuracyScore":           0.96,
    "survivorshipRuleApplied": "MOST_RECENT",

    # Audit
    "createdAt": now,
    "updatedAt": now,
    "createdBy": "SYSTEM_SEED",
    "updatedBy": "SYSTEM_SEED",
    "version":   1
}

# ── Organization Party ────────────────────────────────────────────────────────
org_id  = str(uuid.uuid4())
organization = {
    "id":             org_id,
    "globalId":       org_id,
    "goldenRecordId": org_id,
    "partyType":      "ORGANIZATION",
    "partySubType":   "CUSTOMER",
    "status":         "ACTIVE",

    # Identity
    "organizationName": "Nexus Financial Group",
    "legalName":        "Nexus Financial Group LLC",
    "dbaName":          "NexusFG",
    "fullName":         "Nexus Financial Group LLC",

    # Legal identifiers
    "taxId":      "46-3891204",
    "ein":        "46-3891204",
    "dunsNumber": "12-345-6789",
    "lei":        "549300X7FTTBAL48V89T",
    "naicsCode":  "523110",
    "sicCode":    "6211",

    # Firmographics
    "numberOfEmployees":   4800,
    "annualRevenue":       2450000000.0,
    "incorporationDate":   "2003-09-22",
    "incorporationCountry": "United States",
    "countryOfResidence":  "United States",
    "language":            "en",

    # Contact
    "phones": {
        "MAIN": "+1-212-555-0300",
        "IR":   "+1-212-555-0310"
    },
    "emails": {
        "INFO":      "info@nexusfg.com",
        "INVESTORS": "investors@nexusfg.com"
    },
    "websites": {
        "CORPORATE": "https://www.nexusfg.com"
    },

    # Headquarters address
    "addresses": [
        {
            "addressId":          str(uuid.uuid4()),
            "addressType":        "HEADQUARTERS",
            "isPrimary":          True,
            "isVerified":         True,
            "verificationSource": "USPS_DPV",
            "line1":              "One World Trade Center",
            "line2":              "Suite 4200",
            "city":               "New York",
            "stateProvince":      "NY",
            "postalCode":         "10007",
            "county":             "New York",
            "country":            "United States",
            "countryCode":        "US",
            "latitude":           40.7127,
            "longitude":          -74.0134,
            "geoAccuracy":        "ROOFTOP",
            "dpvConfirmation":    "S",
            "effectiveStartDate": "2010-01-01",
            "sourceSystem":       "ERP_SAP"
        }
    ],

    # Source system
    "sourceSystem":     "ERP_SAP",
    "sourceSystemId":   "SAP-BP-10000042",
    "sourceLastUpdated": now,

    # Golden record metadata
    "isGolden":                True,
    "matchScore":              1.0,
    "confidenceScore":         0.99,
    "dataQualityScore":        0.96,
    "completenessScore":       0.95,
    "accuracyScore":           0.98,
    "survivorshipRuleApplied": "MOST_RECENT",

    # Audit
    "createdAt": now,
    "updatedAt": now,
    "createdBy": "SYSTEM_SEED",
    "updatedBy": "SYSTEM_SEED",
    "version":   1
}

# ── Insert ────────────────────────────────────────────────────────────────────
for doc in [individual, organization]:
    try:
        container.upsert_item(doc)
        print(f"[OK] Created {doc['partyType']}: {doc['fullName']}  [id={doc['id'][:8]}...]")
    except Exception as e:
        print(f"[FAIL] {doc['partyType']}: {e}")

print("\nDone. Records are live in Azure Cosmos DB -> averiodb/parties")
print(f"  Individual   Golden ID : {individual_id}")
print(f"  Organization Golden ID : {org_id}")
