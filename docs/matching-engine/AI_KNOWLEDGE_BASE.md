# Averio MDM Matching Engine — AI Assistant Knowledge Base

> **Purpose:** This file is structured for consumption by AI assistants and NLP systems.
> It answers the most common questions about the matching engine in a consistent,
> machine-parseable format. Each entry includes the canonical question, answer,
> related concepts, and category tags to support semantic search and retrieval.
>
> **Format:** Each Q&A block uses a consistent schema:
> - `Q:` Question (canonical form, written as a user would ask it)
> - `A:` Answer (complete, self-contained, no references to "see above")
> - `TAGS:` Comma-separated topic tags for retrieval
> - `RELATED:` Related question topics

---

## SECTION 1: CORE CONCEPTS

---

**Q: What is the Averio MDM Matching Engine?**

A: The Averio MDM Matching Engine is a software system that determines whether two or more records from different data sources represent the same real-world entity — such as a person, company, employee, or household. It processes millions of records automatically, assigning a confidence score to each potential match. Records that score above a threshold are automatically merged into a single Golden Record. Records in a middle confidence range are sent to a human data steward for review. The engine uses statistical algorithms (Fellegi-Sunter model), machine learning (logistic regression), and AI (GPT-4 blending) to produce accurate match decisions.

TAGS: matching engine, overview, MDM, master data management, what is
RELATED: What is a Golden Record, How does the matching engine work

---

**Q: What is a Golden Record in the context of MDM?**

A: A Golden Record is the single authoritative, deduplicated record for a real-world entity (person, organisation, employee, or household) in an MDM system. When multiple source systems contain data about the same entity, the matching engine identifies those records as duplicates and creates one Golden Record by merging the best attributes from each source using survivorship rules. The Golden Record has a unique Global ID that all source records point to. It is continuously updated as source records change.

TAGS: golden record, master record, survivorship, deduplication, unified record
RELATED: What is survivorship, What is a Global ID, How are records merged

---

**Q: What is a confidence score in the matching engine?**

A: A confidence score is a number between 0.00 and 1.00 (or 0% to 100%) that represents how certain the engine is that two records refer to the same real-world entity. A score of 1.00 means absolute certainty (exact match on a unique identifier). A score of 0.95+ triggers automatic merging. Scores between 0.75 and 0.94 are sent to a human data steward for review. Scores below 0.75 result in a new separate Golden Record being created. The score is computed using the Fellegi-Sunter log-likelihood model, combining evidence from up to 30 attributes.

TAGS: confidence score, match score, probability, threshold, auto-link
RELATED: What are the matching thresholds, How is the score calculated, What is Fellegi-Sunter

---

**Q: What are the matching thresholds and what action does each trigger?**

A: There are three decision thresholds:
- Score ≥ 0.95 (95%): AUTO_LINK — the records are automatically merged into a single Golden Record without human review.
- Score 0.75–0.94: SEND_TO_STEWARD — a StewardTask is created and a human data steward reviews the potential match before any merge happens.
- Score < 0.75: CREATE_NEW — the incoming record is treated as a new, distinct entity and a new Golden Record is created.
Additionally, scores below 0.40 are treated as auto-reject — the engine does not even consider them as potential matches. These thresholds can be customised per matching rule.

TAGS: threshold, auto-link, steward, create new, decision, 0.95, 0.75
RELATED: What is a data steward, Can thresholds be changed, What is a MatchingRule

---

**Q: What is a data steward in MDM?**

A: A data steward is a business or technical user responsible for reviewing borderline match decisions that the automated engine is not confident enough to resolve automatically. When the match confidence is between 0.75 and 0.95, the engine creates a review task for the steward. The steward sees both records side-by-side, the confidence score, and a breakdown of which attributes matched and which did not. They decide to approve the merge (MATCH) or keep the records separate (NO_MATCH). Every steward decision is captured as training data to improve the machine learning model.

TAGS: steward, data steward, human review, steward task, approve, reject merge
RELATED: How does the engine learn from feedback, What happens after a match is found

---

**Q: What is a blocking key in the matching engine?**

A: A blocking key is a simplified fingerprint derived from a party record, used to group similar records into the same candidate bucket without needing to compare every record against every other record. For example, the Double Metaphone phonetic code of "Smith" is "SM0" — this becomes a blocking key that groups "Smith", "Smyth", "Smythe", and "Schmitt" together. The engine generates up to 9 different types of blocking keys per record, including phonetic codes, nickname variants, DOB+initial combinations, phone digit fragments, Tax ID prefixes, email domains, and postal code prefixes. A new incoming record only gets compared against records that share at least one blocking key.

TAGS: blocking key, blocking, candidate generation, inverted index, fingerprint, phonetic
RELATED: How does blocking work, What blocking strategies are used, Why is blocking needed

---

**Q: Why does the matching engine need blocking?**

A: Without blocking, the engine would compare every record against every other record, which is O(N²) complexity. At 100 million records, that is 5 quadrillion comparisons — physically impossible. Blocking reduces this to O(N × k) where k is the average number of candidates per blocking bucket (typically 10–100). At 100 million records with k=50, this becomes 5 billion comparisons — manageable in real time. Blocking works by generating fingerprints (blocking keys) and only comparing records that share at least one fingerprint, under the assumption that true matches will always share at least one blocking key.

TAGS: blocking, performance, scalability, O(N²), trillion scale, inverted index
RELATED: What is a blocking key, What blocking strategies are used

---

**Q: What blocking strategies does the engine use?**

A: The engine uses 9 strategies simultaneously. The union of all matching buckets forms the candidate pool:
1. Double Metaphone on each name token — groups phonetically similar names
2. Nickname variant keys — generates phonetic codes for all known nicknames (Bob→Robert)
3. Full collapsed-name Double Metaphone — catches compound names
4. First initial + last-name phonetic code — "J:SM0" for "John Smith"
5. DOB year+month + name initial — "DOB:1985-3:j"
6. Tax ID / EIN first 4 digits — "TAX:4271"
7. Phone last 7 digits — "PH7:5559876"
8. Email domain + name initial — "EM:gmail.com:j"
9. Exact DUNS / LEI / National ID — deterministic buckets for organisations

TAGS: blocking strategies, phonetic, DOB, tax ID, phone, email domain, DUNS, LEI
RELATED: What is a blocking key, Why does blocking need multiple strategies

---

**Q: What is the Fellegi-Sunter model?**

A: Fellegi-Sunter is a statistical record linkage model developed by Ivan Fellegi and Alan Sunter in 1969. It is the theoretical foundation of the Averio MDM Matching Engine — the same model used by the US Census Bureau, the UK Office for National Statistics (in their Splink software), and the industry-leading dedupe.io tool. The model works by computing a log-likelihood ratio for each attribute: how much more likely is this level of agreement if the records are truly the same entity (m-probability), versus if they are different entities (u-probability). These log-likelihood weights are summed across all available attributes and normalised to a [0, 1] score.

TAGS: Fellegi-Sunter, statistical model, log-likelihood, probabilistic, m probability, u probability
RELATED: What is an m-probability, What is a u-probability, How is the confidence score calculated

---

**Q: What is an m-probability in the matching engine?**

A: The m-probability for an attribute is the probability that two records agree on that attribute, given that they truly represent the same real-world entity. For example, the m-probability for "Date of Birth" is 0.98 — meaning that 98% of the time, two records that are truly the same person will have the same date of birth recorded. The 2% discrepancy accounts for data entry errors, typos, and different date formats. High m-probabilities (close to 1.0) for an attribute mean it is reliable evidence of a match when present.

TAGS: m-probability, match probability, Fellegi-Sunter, attribute probability
RELATED: What is a u-probability, What is the Fellegi-Sunter model, What is the EM algorithm

---

**Q: What is a u-probability in the matching engine?**

A: The u-probability for an attribute is the probability that two records agree on that attribute by chance alone, given that they represent different entities. For example, the u-probability for "Date of Birth" is 0.003 — meaning only 0.3% of random record pairs will happen to share the same date of birth. The u-probability for "City" is much higher at 0.03 — because large cities contain millions of people, many pairs randomly share the same city. Attributes with low u-probabilities (like Tax ID at 0.0001) are highly discriminating — agreement on such attributes is very strong evidence of a match.

TAGS: u-probability, non-match probability, discriminating attribute, Fellegi-Sunter
RELATED: What is an m-probability, Which attributes are most important for matching

---

**Q: What is the EM algorithm and how does the engine use it?**

A: The EM (Expectation-Maximisation) algorithm is an unsupervised machine learning technique that estimates the m and u probabilities for each attribute directly from the data, without requiring any labelled match/non-match examples. The engine randomly samples 5,000 record pairs each night. Since only about 0.1% of random pairs are true matches, the sample is overwhelmingly non-matches — this imbalance is what the EM algorithm exploits. It alternates between estimating which pairs are matches (E-step) and updating the m/u probabilities to maximise the likelihood of those estimates (M-step), repeating until the values converge. This makes the matching parameters specific to your actual data rather than generic domain priors.

TAGS: EM algorithm, expectation maximisation, unsupervised learning, self-learning, m/u estimation
RELATED: What is an m-probability, How does the engine get smarter, When does the EM run

---

**Q: When does the EM algorithm run?**

A: The EM algorithm runs automatically every night at 2:00 AM (UTC) as a scheduled job. It runs separately for each party type (INDIVIDUAL, ORGANIZATION, EMPLOYEE, HOUSEHOLD). It can also be triggered manually via the API endpoint POST /api/v1/matching/em/run/{partyType}. The results are stored in memory and used immediately by the Probabilistic Matcher for subsequent scoring. The algorithm requires at least 50 golden records of the given party type to produce meaningful estimates.

TAGS: EM schedule, nightly, cron, scheduled job, manual trigger
RELATED: What is the EM algorithm, How does the engine get smarter

---

## SECTION 2: MATCHING ALGORITHMS

---

**Q: How does the engine handle nicknames like Bob and Robert?**

A: The engine includes a built-in Nickname Dictionary with over 90 English name equivalence groups. When comparing first names, the NicknameService checks whether the two names belong to the same equivalence group. "Bob", "Bobby", "Rob", and "Robbie" are all registered as equivalents of "Robert". This contributes a similarity of 0.90 (near-certain agreement) to the first-name score. Additionally, the blocking index is expanded to include phonetic keys for all nickname variants, so "Bob Smith" and "Robert Smith" will always appear in the same blocking bucket even though their first names are different.

TAGS: nickname, Bob Robert, name variants, first name, name equivalence
RELATED: What is the NicknameService, How does blocking handle nicknames, Name similarity

---

**Q: How does the engine handle "IBM Corp." versus "IBM Corporation"?**

A: The NameNormalizerService strips legal entity suffixes before any comparison takes place. Both "IBM Corp." and "IBM Corporation" are normalised to "ibm" by removing the suffixes "Corp.", "Corporation", and other common legal suffixes. This normalisation happens before computing similarity scores and before generating blocking keys, ensuring that organisation name variants due to legal suffix formatting never prevent a true match from being found. The engine strips over 30 legal entity suffixes including Inc., Incorporated, LLC, Ltd., Limited, PLC, GmbH, AG, SA, BV, and NV.

TAGS: legal entity suffix, IBM Corp, organisation name normalisation, Corp vs Corporation
RELATED: What is the NameNormalizerService, How are organisation names matched

---

**Q: What string similarity algorithms does the engine use?**

A: The engine uses seven string similarity algorithms, each suited to different types of name variation:
1. Jaro-Winkler (JW): general string similarity with prefix bonus; best for short strings
2. Damerau-Levenshtein (OSA): handles transpositions like "Jonh" → "John"
3. Token Sort Ratio: handles word-order differences ("Smith John" vs "John Smith")
4. Token Set Ratio: handles abbreviations and extra tokens ("IBM Corp" vs "International Business Machines")
5. Bigram Jaccard: robust to insertions and typos ("Jonathan" vs "Johnathan")
6. TF-IDF Cosine: best for long organisation names with many tokens
7. Monge-Elkan: aligns individual tokens across strings with different token counts ("J. Smith Jr." vs "John Smith")
The Probabilistic Matcher uses the maximum of these scores, boosted by phonetic similarity when Double Metaphone codes match.

TAGS: Jaro-Winkler, Damerau-Levenshtein, Token Sort, Token Set, Bigram, TF-IDF, Monge-Elkan, algorithms
RELATED: How is name similarity scored, What is Double Metaphone

---

**Q: How does the engine detect typos in names?**

A: The engine uses the Damerau-Levenshtein (Optimal String Alignment) algorithm, which handles four types of edits: substitutions, insertions, deletions, AND transpositions. A transposition is when two adjacent characters are swapped — for example, "Elizbeth" (missing 'a', 'h' transposed) vs "Elizabeth", or "Jonh" vs "John". Standard Levenshtein treats each transposition as two separate edits, making it harsher on common typing errors. The Damerau-Levenshtein algorithm counts transpositions as a single edit, producing a higher (more accurate) similarity score for records that are the same person with a typo in their name.

TAGS: typo, transposition, Damerau-Levenshtein, edit distance, misspelling, data entry error
RELATED: What string similarity algorithms does the engine use, How does phonetic matching work

---

**Q: How does phonetic matching work?**

A: The engine uses the Double Metaphone algorithm (an improvement on Soundex) to encode names based on their pronunciation rather than their spelling. "Smith", "Smyth", and "Smythe" all encode to "SM0" because they sound alike. Double Metaphone is used in two ways: (1) as a blocking key to group phonetically similar records together, and (2) as a direct similarity feature in the probabilistic scorer. Unlike Soundex, Double Metaphone handles both English-origin names and foreign-origin names (German, French, Spanish, etc.) and provides alternate codes for names with ambiguous pronunciation.

TAGS: phonetic, Double Metaphone, Soundex, phonetic matching, pronunciation, spelling variants
RELATED: What is a blocking key, How does the engine handle name spelling variants

---

**Q: How does the engine handle transpositions in dates of birth?**

A: When comparing dates of birth, if the exact date does not match, the engine checks for common data entry errors including day/month transpositions. For example, if Record A has DOB = 1985-03-15 (March 15) and Record B has DOB = 1985-15-03 in a different format (interpreted as day=15, month=03), the engine detects this transposition and assigns a partial DOB similarity of 0.80 instead of 0.00. This handles a very common error where the day and month are entered in the wrong order, particularly when the source system has different date format standards.

TAGS: date of birth, DOB, transposition, day month swap, date format, partial DOB
RELATED: How is DOB scored, How does the engine handle partial matches

---

**Q: What is transitive closure and why does it matter for golden records?**

A: Transitive closure means: if Record A matches Record B, and Record B matches Record C, then A, B, and C are all the same entity and should produce one golden record. Without transitive closure, you could end up with multiple golden records for the same real-world entity — one for {A, B} and another for {B, C}. The engine uses the Union-Find (Disjoint Set Union) algorithm to compute transitive closure efficiently across all record pairs simultaneously. This is the same clustering step used by industry tools like Splink.

TAGS: transitive closure, cluster, Union-Find, DSU, connected components, chain
RELATED: What is the ClusterMergeService, How is a golden record cluster formed

---

## SECTION 3: DATA AND ATTRIBUTES

---

**Q: Which attributes are most important for individual matching?**

A: For individuals, the most discriminating attributes (ranked by evidence weight) are:
1. SSN / National ID — near-certainty (m=0.999, u=0.00001)
2. Date of Birth — very strong (m=0.98, u=0.003)
3. Email address (exact) — very strong (m=0.92, u=0.002)
4. Phone number (exact digits) — strong (m=0.88, u=0.003)
5. Last name — strong (m=0.95, u=0.006)
6. First name with nickname matching — strong (m=0.92 for JW, 0.88 for nickname)
7. Postal code — moderate (m=0.87, u=0.028)
Missing an identifier reduces confidence but does not prevent matching — the engine combines all available evidence.

TAGS: individual, INDIVIDUAL, important attributes, SSN, date of birth, email, phone
RELATED: How is the confidence score calculated, What is an m-probability

---

**Q: Which attributes are most important for organisation matching?**

A: For organisations, the most discriminating attributes are:
1. Tax ID / EIN — near-certainty (m=0.999, u=0.0001) — ALWAYS provide this
2. DUNS Number — near-certainty (m=0.999, u=0.0001)
3. LEI (Legal Entity Identifier) — near-certainty (m=0.999, u=0.0001)
4. Email address (exact) — very strong
5. Organisation name (with normalisation) — strong after suffix stripping
6. Phone number — strong
7. Postal code — moderate
For organisations, the Tax ID / EIN is by far the most important attribute. A matching Tax ID triggers an immediate deterministic match (AUTO_LINK) regardless of other attributes.

TAGS: organisation, ORGANIZATION, tax ID, EIN, DUNS, LEI, important attributes
RELATED: What is a deterministic match, How does organisation name normalisation work

---

**Q: What happens when two records have different party types?**

A: Records with different party types are never matched against each other. An INDIVIDUAL record will not be compared to an ORGANIZATION record. The blocking system generates type-specific keys, and the matching pipeline filters candidates by party type before scoring. This is intentional: a person and a company cannot be the same entity. If a source system incorrectly assigns party types, this will prevent matching — ensuring correct party type is a data quality requirement.

TAGS: party type, INDIVIDUAL, ORGANIZATION, cross-type, type mismatch
RELATED: What party types are supported, What are the data quality requirements

---

**Q: What party types does the engine support?**

A: The engine supports four party types: INDIVIDUAL (natural persons, customers, consumers), ORGANIZATION (companies, businesses, non-profits, government entities), EMPLOYEE (persons in an employment relationship — can overlap with INDIVIDUAL), and HOUSEHOLD (family/address grouping). Each party type has separately tuned matching parameters (m/u probabilities from the EM algorithm), separate ML models, and type-specific attribute scoring logic (e.g., organisation name scoring is not applied to individuals).

TAGS: party type, INDIVIDUAL, ORGANIZATION, EMPLOYEE, HOUSEHOLD
RELATED: Which attributes are most important, How does the EM algorithm work

---

**Q: How does the engine handle missing data?**

A: Missing data is handled gracefully. If an attribute is absent in either record, it simply does not contribute to the score — neither positively nor negatively. Only attributes where both records have data are included in the Fellegi-Sunter calculation. This means the maximum possible score varies depending on available data: a pair with Tax ID, DOB, and email can achieve a higher maximum score than a pair with only name and city. The engine normalises the score based on available attributes, so a high score on limited data is still meaningful.

TAGS: missing data, null, empty, partial data, incomplete record
RELATED: How is the confidence score calculated, What are the data quality requirements

---

**Q: Does providing more data fields improve matching accuracy?**

A: Yes, significantly. Each additional data field that is present in both records adds another piece of evidence to the likelihood calculation. Tax ID alone is often sufficient for organisation matching (deterministic). For individuals, having name + DOB + email + phone together is much more reliable than name alone. The engine is designed to use whatever data is available, but providing high-discriminating identifiers (Tax ID, SSN, email) whenever possible produces the most accurate and confident results.

TAGS: data quality, more fields, accuracy, completeness, identifiers
RELATED: What are the data quality requirements, Which attributes are most important

---

## SECTION 4: SYSTEM BEHAVIOUR

---

**Q: How does the engine scale to billions of records?**

A: The engine uses a blocking architecture that reduces the matching problem from O(N²) to O(N × k) where k is the average candidate bucket size (typically 10–100). The blocking index is a ConcurrentHashMap-based inverted index that maps blocking keys to sets of globalIds. For each incoming record, the engine generates up to 30 blocking keys, looks them up in the index, and retrieves only the candidate globalIds — typically 10–200 records, not billions. The scoring step (Fellegi-Sunter + feature extraction + similarity computation) then runs only on those candidates. For production deployments with more than 100 million records, the blocking index can be backed by Redis or Elasticsearch while the API remains unchanged.

TAGS: scalability, trillion records, performance, O(N²), blocking index, Redis
RELATED: What blocking strategies are used, What are the performance characteristics

---

**Q: How long does it take to match a record?**

A: For a typical deployment with 10 million golden records: blocking key lookup takes less than 2 milliseconds; scoring 50–200 candidates (each requiring feature extraction + Fellegi-Sunter calculation) takes approximately 10 milliseconds; total end-to-end matching takes approximately 12 milliseconds per incoming record. For 100 million records, the total is approximately 55 milliseconds per record. These times are on a single JVM instance; the system can be scaled horizontally for higher throughput.

TAGS: performance, latency, response time, milliseconds, throughput
RELATED: How does the engine scale to billions of records

---

**Q: How does the engine learn from steward decisions?**

A: Every steward decision (approve or reject merge) is captured by the engine as a MatchingFeedback record containing the 11-dimensional feature vector of the pair and the decision label (MATCH or NO_MATCH). Once 5 or more new feedback records have been accumulated, the system automatically triggers an asynchronous retraining of the logistic regression model. The retrained model is evaluated for accuracy, precision, recall, and F1 score. Subsequent soft-match suggestions use the updated model. The Fellegi-Sunter parameters are updated separately via the nightly EM algorithm.

TAGS: learning, feedback, steward decision, retraining, model update, improve
RELATED: What is the EM algorithm, What is the ML model, How is the model trained

---

**Q: Can the matching thresholds be customised?**

A: Yes. Matching Rules allow full customisation of thresholds and attribute weights. The AUTO_LINK threshold (default 0.95), SEND_TO_STEWARD threshold (default 0.75), and whether to enable AI enhancement can all be configured per rule. Additionally, individual attribute weights can be specified — for example, doubling the weight of Tax ID for financial organisations, or increasing the weight of email for digital-first businesses. Matching Rules can be applied globally, per party type, or per source system combination.

TAGS: custom threshold, matching rule, attribute weight, configuration, customise
RELATED: What are the matching thresholds, What is a MatchingRule

---

**Q: What is the AI enhancement layer?**

A: The AI Enhancement layer uses GPT-4 to evaluate borderline match pairs — those where the statistical model produces a confidence between 0.50 and 0.90. In this "grey zone", the Probabilistic Matcher is less certain, and GPT-4's language understanding can catch patterns that are hard to encode statistically (unusual name formats, cultural name conventions, ambiguous abbreviations). The final score in this zone is a weighted blend: 60% from the Fellegi-Sunter probabilistic score and 40% from the GPT-4 assessment. This layer is optional and can be disabled per matching rule.

TAGS: AI enhancement, GPT-4, borderline, grey zone, AI, language model
RELATED: What are the matching thresholds, How is the confidence score calculated

---

**Q: What is the difference between soft matching and hard matching?**

A: Hard matching is the real-time process that occurs when a new party record is submitted for matching. It uses blocking + Fellegi-Sunter + AI to find matches and immediately produces a decision (AUTO_LINK, SEND_TO_STEWARD, or CREATE_NEW). Soft matching is a background process that proactively scans existing golden records to find pairs that may be duplicates of each other — records that slipped through earlier matching runs, were ingested before the engine was set up, or whose similarity only became apparent after model updates. Soft-match suggestions are generated by the ML service and placed in the steward review queue.

TAGS: soft match, hard match, proactive, background, duplicate detection, scan
RELATED: How does the ML soft-match scan work, What is the ML model

---

**Q: How does the engine handle an organisation that appears under multiple names?**

A: The engine uses multiple complementary strategies to identify the same organisation across different name representations. First, the NameNormalizerService strips legal suffixes so "IBM Corp." and "IBM Corporation" both become "ibm". Second, Token Sort and Token Set similarity measures handle word-order and extra-token differences ("General Electric Company" vs "Company General Electric" vs "GE"). Third, TF-IDF Cosine similarity handles long names with many shared tokens. Fourth, Monge-Elkan aligns individual tokens to find the best matching pairs. And fifth, if a DUNS number, Tax ID, or LEI is present on both records, that produces a deterministic match regardless of name differences.

TAGS: organisation name, multiple names, name variants, same company, abbreviation
RELATED: How does organisation name normalisation work, What is a deterministic match

---

**Q: What happens when a record is merged into an existing golden record?**

A: When records are merged (either automatically or after steward approval), the following occurs: (1) The incoming source record is linked to the existing golden record via its globalId. (2) Survivorship rules are applied to each attribute — for example, "most recently updated wins" or "most trusted source wins". (3) The golden record is updated with the surviving attribute values. (4) The blocking index is updated to include the new source record's blocking keys mapped to the existing golden record's globalId. (5) Any downstream systems subscribed to golden record updates are notified via event streaming.

TAGS: merge, survivorship, golden record update, how merge works, post-merge
RELATED: What is survivorship, What is a Golden Record, What is the blocking index

---

**Q: How does the engine handle an incorrectly merged golden record (false positive)?**

A: If a data steward identifies an incorrect merge, they can "unmerge" or "split" the golden record through the steward interface. The system creates two separate golden records from the incorrectly merged cluster. The steward decision (REJECT_MERGE) is captured as negative training data (NO_MATCH label) with the feature vector of that pair, preventing the same pair from being matched again. The EM algorithm and ML model will incorporate this feedback in their next update cycle.

TAGS: false positive, incorrect merge, unmerge, split, error correction
RELATED: What is a data steward, How does the engine learn from feedback

---

**Q: Is the matching engine configurable per source system?**

A: Yes. Matching Rules can specify different configurations for different source system combinations. For example, records from a highly trusted internal ERP system might have a lower AUTO_LINK threshold (0.90) because the data quality is high, while records from an external partner feed might require a higher threshold (0.98) because the data quality is lower. Attribute weights can also be adjusted per source system — for instance, giving higher weight to DOB from a government-verified source than from a self-reported web form.

TAGS: source system, configuration, per source, trusted source, customise
RELATED: What is a MatchingRule, Can thresholds be customised

---

## SECTION 5: VENDOR AND INTEGRATION

---

**Q: What data does a vendor need to provide for best matching results?**

A: For best matching results, vendors should provide: For individuals — first name, last name, date of birth (most important), email address, phone number, and postal address. For organisations — organisation name, Tax ID or EIN (most important), phone number, email, postal address, and if available DUNS or LEI numbers. The minimum required fields are: sourceSystem, sourceSystemId, partyType, and either (firstName + lastName) for individuals or (organizationName) for organisations. Additional fields significantly improve match confidence and reduce steward review volume.

TAGS: vendor, data requirements, required fields, best results, what to provide
RELATED: What are the data quality requirements, API integration

---

**Q: How should a vendor format dates for submission?**

A: Dates should be provided in ISO 8601 format: YYYY-MM-DD. For example, March 15, 1985 should be submitted as 1985-03-15. The engine handles day/month transpositions in matching (e.g., detecting 1985-15-03 as a likely data entry error for 1985-03-15), but the preferred canonical format is YYYY-MM-DD to avoid ambiguity.

TAGS: date format, ISO 8601, YYYY-MM-DD, date of birth, date formatting
RELATED: How does the engine handle DOB transpositions, What data should a vendor provide

---

**Q: How should a vendor format phone numbers?**

A: Any standard phone number format is accepted. The engine normalises all phone numbers by extracting only the digits before comparison. "+1 (212) 555-9876", "212-555-9876", "12125559876", and "2125559876" will all be compared as "2125559876". For best matching on international numbers, include the country code. The engine compares the last 10 digits for a full match and the last 7 digits for a partial match (which handles country code and area code variations).

TAGS: phone format, phone number, normalisation, international, country code
RELATED: How are phone numbers matched, What data should a vendor provide

---

**Q: Does the engine match records across different source systems?**

A: Yes. The matching engine is specifically designed to find duplicate records across different source systems. When records from System A and System B are both ingested, the engine generates blocking keys for all records regardless of source, and comparisons happen across all system boundaries. In fact, a field called sourceSystemDiversity is a positive signal in the feature vector — two records from different source systems that match are more likely to represent the same entity than two records from the same system (which might indicate a legitimate internal duplicate entry error that should be investigated differently).

TAGS: cross-system, source system diversity, multiple systems, cross-source matching
RELATED: What is a feature vector, How does source system affect matching

---

*End of AI Knowledge Base. For full technical details see TECHNICAL_ARCHITECTURE.md. For business context see BUSINESS_GUIDE.md.*
