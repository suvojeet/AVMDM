package com.averio.mdm.engine.matching;

import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Name equivalence service covering 90+ English nickname/variant groups.
 *
 * Critical for individual MDM: enterprise data will have "Bob Smith" in CRM
 * and "Robert Smith" in ERP. Without this service they would not match.
 *
 * Usage:
 *   nicknameService.similarity("Bob", "Robert")  → 0.90
 *   nicknameService.similarity("Bob", "Bob")     → 1.00
 *   nicknameService.similarity("Bob", "Alice")   → 0.00
 *   nicknameService.areEquivalent("Liz", "Elizabeth") → true
 */
@Service
public class NicknameService {

    // Each inner list is one equivalence group — all names are interchangeable
    // (canonical form is first; others are nicknames, diminutives, spelling variants)
    private static final List<List<String>> GROUPS = List.of(
        // ── Male names ────────────────────────────────────────────────────────
        List.of("robert",     "bob", "bobby", "rob", "robbie", "robby", "bert"),
        List.of("william",    "bill", "billy", "will", "willy", "liam", "wil"),
        List.of("james",      "jim", "jimmy", "jamie", "jem"),
        List.of("john",       "jonathan", "johnny", "jonnie", "jon", "jonny"),
        List.of("thomas",     "tom", "tommy", "tomas"),
        List.of("michael",    "mike", "mikey", "micky", "mickey", "michel"),
        List.of("richard",    "rich", "rick", "ricky", "dick", "richie"),
        List.of("charles",    "charlie", "chuck", "chas", "carl", "chaz"),
        List.of("george",     "georgie", "jorge"),
        List.of("david",      "dave", "davey", "davy"),
        List.of("edward",     "ed", "eddie", "ned", "ted", "eddy", "edwardo"),
        List.of("joseph",     "joe", "joey", "jose"),
        List.of("daniel",     "dan", "danny"),
        List.of("christopher","chris", "kris", "cris", "topher"),
        List.of("matthew",    "matt", "matty", "matthias"),
        List.of("andrew",     "andy", "drew", "andre"),
        List.of("anthony",    "tony", "toni", "antonio"),
        List.of("kevin",      "kev"),
        List.of("steven",     "steve", "stevie", "stephen", "stefan"),
        List.of("stephen",    "steve", "stevie", "steven", "stefan"),
        List.of("patrick",    "pat", "paddy", "rick"),
        List.of("timothy",    "tim", "timmy"),
        List.of("nicholas",   "nick", "nicky", "nico", "cole"),
        List.of("benjamin",   "ben", "benny", "benji", "benjy"),
        List.of("samuel",     "sam", "sammy"),
        List.of("lawrence",   "larry", "laurie", "lars"),
        List.of("alexander",  "alex", "alec", "sandy", "xander", "sasha"),
        List.of("frederick",  "fred", "freddy", "fritz"),
        List.of("gregory",    "greg", "gregg"),
        List.of("jonathan",   "john", "johnny", "jonnie", "jon", "jonny", "nathan"),
        List.of("donald",     "don", "donnie", "donny"),
        List.of("kenneth",    "ken", "kenny"),
        List.of("joshua",     "josh"),
        List.of("henry",      "hank", "harry", "hal"),
        List.of("philip",     "phil", "flip", "phillip"),
        List.of("jeffrey",    "jeff", "geoff"),
        List.of("geoffrey",   "geoff", "jeff"),
        List.of("theodore",   "ted", "theo", "teddy"),
        List.of("albert",     "al", "bert", "albie"),
        List.of("walter",     "walt", "wally"),
        List.of("francis",    "frank", "fran", "franz"),
        List.of("frank",      "franklin", "frankie"),
        List.of("arthur",     "art", "arty"),
        List.of("leonard",    "len", "leo", "lenny", "leon"),
        List.of("gerald",     "jerry", "gerry"),
        List.of("raymond",    "ray", "remy"),
        List.of("ernest",     "ernie", "ernst"),
        List.of("eugene",     "gene"),
        List.of("harold",     "harry", "hal"),
        List.of("bernard",    "bernie", "barney"),
        List.of("vincent",    "vince", "vinny", "vin"),
        List.of("douglas",    "doug", "dougie"),
        List.of("dennis",     "den", "denny"),
        List.of("nathan",     "nat", "nate", "nathanael", "nathaniel"),
        List.of("nathaniel",  "nat", "nate", "nathan"),
        List.of("russell",    "russ", "rusty"),
        List.of("marcus",     "mark", "marc"),
        List.of("peter",      "pete", "petey"),
        List.of("aaron",      "aron"),
        List.of("abraham",    "abe", "bram"),
        List.of("adam",       "ad"),
        List.of("alan",       "al", "allen", "allan"),
        List.of("alfred",     "alf", "fred", "alfie"),
        List.of("barry",      "barrie"),
        List.of("brendan",    "bren"),
        List.of("brian",      "bryan", "bri"),
        List.of("calvin",     "cal"),
        List.of("carl",       "karl", "carlos"),
        List.of("clarence",   "clare"),
        List.of("clifford",   "cliff"),
        List.of("clyde",      "cy"),
        List.of("craig",      "cregg"),
        List.of("dale",       "dail"),
        List.of("derek",      "derry", "derrick"),
        List.of("dominic",    "dom", "nick"),
        List.of("edgar",      "ed", "eddie"),
        List.of("elijah",     "eli", "elias"),
        List.of("elliot",     "eli", "elliott"),
        List.of("ethan",      "eth"),
        List.of("evan",       "ev", "ivan"),
        List.of("gabriel",    "gabe"),
        List.of("grant",      "grey"),
        List.of("jacob",      "jake", "jac"),
        List.of("jason",      "jay", "jace"),
        List.of("leonard",    "leo", "leon", "len"),
        List.of("liam",       "william"),
        List.of("lloyd",      "loy"),
        List.of("louis",      "lou", "lewis", "luigi", "luis"),
        List.of("martin",     "mart", "marty"),
        List.of("melvin",     "mel"),
        List.of("mitchell",   "mitch"),
        List.of("norman",     "norm"),
        List.of("oliver",     "ollie", "ol"),
        List.of("oscar",      "oz"),
        List.of("paul",       "paulie"),
        List.of("randolph",   "randy", "rand"),
        List.of("reginald",   "reg", "reggie"),
        List.of("riley",      "rye"),
        List.of("rodney",     "rod"),
        List.of("roland",     "rolly", "ron"),
        List.of("ronald",     "ron", "ronnie", "ronny"),
        List.of("sebastian",  "seb"),
        List.of("simon",      "si"),
        List.of("spencer",    "spence"),
        List.of("stanley",    "stan"),
        List.of("stewart",    "stu", "stew", "stuart"),
        List.of("tobias",     "toby"),
        List.of("tyler",      "ty"),
        List.of("victor",     "vic"),
        List.of("wayne",      "wane"),
        List.of("xavier",     "xav"),
        // ── Female names ──────────────────────────────────────────────────────
        List.of("elizabeth",  "liz", "lizzie", "beth", "betsy", "betty", "eliza", "lisa", "elspeth", "bessie", "libby"),
        List.of("katherine",  "kate", "katie", "kathy", "kay", "kitty", "kath", "kat"),
        List.of("catherine",  "kate", "katie", "kathy", "kay", "kitty", "kath", "cat"),
        List.of("margaret",   "maggie", "peggy", "peg", "meg", "marge", "margie", "rita", "mags"),
        List.of("mary",       "mamie", "molly", "polly", "may", "mae", "maria", "marie"),
        List.of("susan",      "sue", "susie", "suzy", "suzie"),
        List.of("patricia",   "pat", "patty", "tricia", "trish"),
        List.of("barbara",    "barb", "barbie", "babs"),
        List.of("jennifer",   "jen", "jenny", "jenn"),
        List.of("dorothy",    "dot", "dottie", "dolly"),
        List.of("helen",      "nell", "nellie", "eleanor"),
        List.of("sandra",     "sandy", "sandi"),
        List.of("deborah",    "deb", "debbie", "debi"),
        List.of("christine",  "chris", "chrissy", "kris", "tina"),
        List.of("christina",  "chris", "tina", "kris"),
        List.of("rebecca",    "becky", "becca", "reba"),
        List.of("sharon",     "shari", "sherry"),
        List.of("linda",      "lin", "lindy", "lynda"),
        List.of("nancy",      "nan", "nance"),
        List.of("carol",      "carrie", "cari", "carolyn"),
        List.of("carolyn",    "carol", "carrie"),
        List.of("virginia",   "ginny", "ginger", "virgie"),
        List.of("diane",      "di", "dee"),
        List.of("joan",       "jo", "joanne", "joanna"),
        List.of("amanda",     "mandy"),
        List.of("melissa",    "mel", "missy", "melly"),
        List.of("stephanie",  "steph"),
        List.of("angela",     "angie"),
        List.of("kathleen",   "kathy", "kath", "kay"),
        List.of("pamela",     "pam", "pammy"),
        List.of("judith",     "judy", "judi"),
        List.of("evelyn",     "ev", "evie"),
        List.of("charlotte",  "charlie", "lottie", "lotte"),
        List.of("jacqueline", "jackie", "jacqui"),
        List.of("cheryl",     "cher", "sherry"),
        List.of("victoria",   "vicki", "vickie", "tori", "vicky"),
        List.of("anne",       "annie", "ann", "anna"),
        List.of("anna",       "ann", "anne", "annie", "ana"),
        List.of("emily",      "em", "emmie"),
        List.of("nikole",     "nicky", "nikki", "nicole", "nic"),
        List.of("nicole",     "nicky", "nikki", "nic"),
        List.of("diana",      "di", "dee"),
        List.of("pauline",    "paula", "polly"),
        List.of("abigail",    "abby", "abbie", "gail"),
        List.of("alice",      "ali", "ally"),
        List.of("alicia",     "ali", "ally"),
        List.of("allison",    "allie", "ally"),
        List.of("amy",        "amie"),
        List.of("andrea",     "andy", "andrea"),
        List.of("april",      "ape"),
        List.of("audrey",     "audie"),
        List.of("beverley",   "bev"),
        List.of("bridget",    "brid", "bridie"),
        List.of("brenda",     "bren"),
        List.of("cynthia",    "cindy", "cyndi"),
        List.of("danielle",   "dani", "danny"),
        List.of("elaine",     "lainie"),
        List.of("frances",    "fran", "frannie"),
        List.of("gwendolyn",  "gwen"),
        List.of("harriet",    "harry", "hattie"),
        List.of("heather",    "heath"),
        List.of("irene",      "rene", "reenie"),
        List.of("janet",      "jan"),
        List.of("jean",       "jennie", "jenny"),
        List.of("jessica",    "jess", "jessie"),
        List.of("joanne",     "jo", "joan"),
        List.of("josephine",  "jo", "josie"),
        List.of("julia",      "julie"),
        List.of("laura",      "laurie", "lori"),
        List.of("lesley",     "les"),
        List.of("lorraine",   "lorrie", "lori"),
        List.of("louise",     "lou", "louisa"),
        List.of("lucy",       "lu"),
        List.of("lynette",    "lyn", "lynnie"),
        List.of("madeleine",  "maddie", "maddy", "madeline"),
        List.of("natalie",    "nat", "natty"),
        List.of("norma",      "norm"),
        List.of("olivia",     "ollie", "liv"),
        List.of("penelope",   "penny"),
        List.of("phyllis",    "phyl"),
        List.of("rachel",     "rae", "rach"),
        List.of("roberta",    "bobbie", "bert"),
        List.of("rosemary",   "rosie"),
        List.of("ruth",       "ruthie"),
        List.of("samantha",   "sam", "sammy"),
        List.of("sarah",      "sara", "sadie", "sal"),
        List.of("shirley",    "shirl"),
        List.of("sophia",     "sophie"),
        List.of("suzanne",    "sue", "suzi", "suzy"),
        List.of("tiffany",    "tiff"),
        List.of("vanessa",    "van", "vanny"),
        List.of("veronica",   "ronnie", "vera"),
        List.of("wendy",      "wen"),
        List.of("yvonne",     "von", "yvie")
    );

    /** name (normalised) → set of all equivalent names including itself */
    private final Map<String, Set<String>> lookup = new HashMap<>();

    public NicknameService() {
        for (List<String> group : GROUPS) {
            Set<String> groupSet = new HashSet<>(group);
            for (String name : group) {
                lookup.merge(name, groupSet, (existing, newSet) -> {
                    Set<String> merged = new HashSet<>(existing);
                    merged.addAll(newSet);
                    return merged;
                });
            }
        }
    }

    /**
     * Returns 1.0 for identical names, 0.90 for known nickname pairs, 0.0 otherwise.
     * Plug the result in as a feature or similarity boost.
     */
    public double similarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        String na = n(a), nb = n(b);
        if (na.isEmpty() || nb.isEmpty()) return 0.0;
        if (na.equals(nb)) return 1.0;
        Set<String> groupA = lookup.get(na);
        if (groupA != null && groupA.contains(nb)) return 0.90;
        Set<String> groupB = lookup.get(nb);
        if (groupB != null && groupB.contains(na)) return 0.90;
        return 0.0;
    }

    /** True when a and b are known equivalents (includes exact match). */
    public boolean areEquivalent(String a, String b) {
        return similarity(a, b) >= 0.90;
    }

    /** Return all known equivalents for a name, including the name itself. */
    public Set<String> variants(String name) {
        if (name == null) return Collections.emptySet();
        Set<String> group = lookup.get(n(name));
        return group != null ? Collections.unmodifiableSet(group) : Set.of(n(name));
    }

    private String n(String s) { return s.toLowerCase().trim(); }
}
