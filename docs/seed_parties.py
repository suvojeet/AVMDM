"""
Seed 16 realistic demo parties into the running Averio MDM backend.
Calls POST /api/v1/parties/ingest for each party — matching runs automatically.

Round 1 (base parties) is ingested first, then Round 2 (near-duplicates) so
the matching engine can compare them and create steward review tasks.

Usage:
    python docs/seed_parties.py
"""

import requests, json, sys

BASE = "http://localhost:8080/api/v1"
HEADERS = {"Content-Type": "application/json"}

# ── helpers ───────────────────────────────────────────────────────────────────

def addr(line1, city, state, postal):
    return {"line1": line1, "city": city, "stateProvince": state,
            "postalCode": postal, "country": "USA", "countryCode": "US",
            "addressType": "PRIMARY", "isPrimary": True, "isVerified": True}

def phone(number):
    return {"phoneType": "MOBILE", "countryDialCode": "+1",
            "phoneNumber": number, "isPrimary": True, "isVerified": True}

def email(address):
    return {"emailType": "PRIMARY", "email": address,
            "isPrimary": True, "isVerified": True}

def individual(source, source_id, first, last, dob, sub_type, address, ph=None, em=None):
    return {
        "partyType": "INDIVIDUAL", "partySubType": sub_type,
        "sourceSystem": source, "sourceSystemId": source_id,
        "firstName": first, "lastName": last, "fullName": f"{first} {last}",
        "dateOfBirth": dob, "status": "ACTIVE",
        "nationality": "USA", "countryOfResidence": "USA",
        "addresses":      [address] if address else [],
        "phoneNumbers":   [ph]      if ph      else [],
        "emailAddresses": [em]      if em      else [],
    }

def organization(source, source_id, org_name, legal_name,
                 tax_id=None, duns=None, lei=None, address=None):
    p = {
        "partyType": "ORGANIZATION", "partySubType": "CUSTOMER",
        "sourceSystem": source, "sourceSystemId": source_id,
        "organizationName": org_name, "legalName": legal_name, "fullName": org_name,
        "status": "ACTIVE", "incorporationCountry": "USA",
        "addresses":      [address] if address else [],
        "phoneNumbers": [], "emailAddresses": [],
    }
    if tax_id: p["taxId"]      = tax_id
    if duns:   p["dunsNumber"] = duns
    if lei:    p["lei"]        = lei
    return p

# ── Round 1 — base parties (ingested first) ───────────────────────────────────

ROUND1 = [
    individual("CRM",  "02121414",   "John",    "Smith",    "1975-03-15", "CUSTOMER",
               addr("123 Main St", "New York", "NY", "10001"),
               phone("2125550101"), email("john.smith@gmail.com")),

    individual("HR",   "HR-SC-001",  "Sarah",   "Connor",   "1985-07-22", "EMPLOYEE",
               addr("456 Oak Ave", "Los Angeles", "CA", "90001"),
               phone("3105550202"), email("sconnor@company.com")),

    individual("KYC",  "KYC-WA-001", "William", "Anderson", "1968-11-08", "CUSTOMER",
               addr("789 Pine Rd", "Chicago", "IL", "60601"),
               phone("3125550303"), email("william.anderson@business.net")),

    organization("CRM", "CORP-00412", "Apple Inc.", "Apple Inc.",
                 tax_id="94-2404110", duns="009531141",
                 address=addr("One Apple Park Way", "Cupertino", "CA", "95014")),

    organization("CRM", "CRM-GS-001", "Goldman Sachs Group Inc.", "Goldman Sachs Group, Inc.",
                 tax_id="13-4019460", lei="W22LROWP2IHZNBB6K528",
                 address=addr("200 West St", "New York", "NY", "10282")),

    organization("ERP", "ERP-MS-001", "Microsoft Corporation", "Microsoft Corporation",
                 tax_id="91-1144442", duns="145001003",
                 address=addr("One Microsoft Way", "Redmond", "WA", "98052")),

    organization("KYC", "KYC-JP-001", "JPMorgan Chase & Co.", "JPMorgan Chase & Co.",
                 tax_id="13-2624428",
                 address=addr("383 Madison Ave", "New York", "NY", "10179")),

    organization("CRM", "CRM-BR-001", "BlackRock Inc.", "BlackRock, Inc.",
                 tax_id="32-0174431",
                 address=addr("55 East 52nd St", "New York", "NY", "10055")),

    individual("HR",  "HR-EC-001",  "Emily",  "Chen",  "1992-04-15", "EMPLOYEE",
               addr("101 Market St", "San Francisco", "CA", "94105"),
               None, email("emily.chen@techco.com")),

    individual("CRM", "CRM-RD-001", "Robert", "Davis", "1961-09-03", "CUSTOMER",
               addr("4500 Texas Ave", "Houston", "TX", "77002"),
               phone("7135550404"), None),
]

# ── Round 2 — near-duplicates (trigger matching against Round 1) ──────────────

ROUND2 = [
    # Jonathan Smith: same DOB + same phone as John Smith → ~78% → REVIEW task
    individual("ERP",  "NT023512",    "Jonathan", "Smith",    "1975-03-15", "CUSTOMER",
               addr("123 Main Street", "New York", "NY", "10001"),
               phone("2125550101"), email("jon.smith@gmail.com")),

    # Sara K. Connor: same DOB + same phone as Sarah Connor → ~82% → REVIEW task
    individual("CRM",  "CRM-SKC-001", "Sara",     "Connor",   "1985-07-22", "EMPLOYEE",
               addr("456 Oak Avenue", "Los Angeles", "CA", "90001"),
               phone("3105550202"), email("s.connor@company.com")),

    # Bill Anderson: nickname of William, same DOB → ~80% → REVIEW task
    individual("BANK", "BANK-BA-001", "Bill",     "Anderson", "1968-11-08", "CUSTOMER",
               addr("789 Pine Road", "Chicago", "IL", "60601"),
               phone("3125550303"), None),

    # Apple Incorporated: same taxId + DUNS → deterministic → AUTO-LINK (merge)
    organization("ERP", "CORP-00509", "Apple Incorporated", "Apple Incorporated",
                 tax_id="94-2404110", duns="009531141",
                 address=addr("1 Apple Park Way", "Cupertino", "CA", "95014")),

    # Goldman Sachs & Co. LLC: same address, no shared ID → ~80% → REVIEW task
    organization("ERP", "ERP-GS-001", "Goldman Sachs & Co. LLC", "Goldman Sachs & Co. LLC",
                 address=addr("200 West Street", "New York", "NY", "10282")),

    # Amazon — no duplicate, just adds to party list
    organization("CRM", "CRM-AMZ-001", "Amazon.com Inc.", "Amazon.com, Inc.",
                 tax_id="91-1087516",
                 address=addr("410 Terry Ave N", "Seattle", "WA", "98109")),
]

# ── ingest ────────────────────────────────────────────────────────────────────

def ingest(party, label=""):
    name = party.get("fullName") or party.get("organizationName") or "?"
    try:
        r = requests.post(f"{BASE}/parties/ingest", headers=HEADERS,
                          data=json.dumps(party), timeout=30)
        if r.status_code in (200, 201):
            saved = r.json()
            gid = saved.get("globalId", "?")
            print(f"  OK  {label:<8}  {name:<40}  globalId={gid}")
            return True
        else:
            print(f"  ERR {label:<8}  {name:<40}  HTTP {r.status_code}: {r.text[:120]}")
            return False
    except Exception as e:
        print(f"  EXC {label:<8}  {name:<40}  {e}")
        return False

ok = err = 0
print("\n=== Round 1 — base parties ===")
for p in ROUND1:
    if ingest(p, "base"): ok += 1
    else: err += 1

print("\n=== Round 2 — near-duplicates (matching triggered) ===")
for p in ROUND2:
    if ingest(p, "near-dup"): ok += 1
    else: err += 1

print(f"\nDone: {ok} ingested, {err} errors.")
print("Open Party Master to see parties.")
print("Open Steward Console to see auto-created match review tasks.")
