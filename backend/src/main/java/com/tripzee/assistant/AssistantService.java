package com.tripzee.assistant;

import com.tripzee.destination.DestinationDtos.DestinationCard;
import com.tripzee.destination.DestinationDtos.RatingStats;
import com.tripzee.destination.DestinationService;
import com.tripzee.domain.Destination;
import com.tripzee.repo.DestinationRepository;
import com.tripzee.trip.LlmClient;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Travel assistant. With an LLM key it answers conversationally, grounded on Tripzee's curated
 * destination data. Without one it answers from the same data using intent rules. In both modes
 * unverified facts (fees, hours) are never stated as fact.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssistantService {
    private final DestinationRepository destinations;
    private final DestinationService destinationService;
    private final LlmClient llm;

    public record Turn(String role, String content) {}

    public record Reply(String reply, String source, List<DestinationCard> destinations, List<String> suggestions) {}

    enum Intent { HISTORY, CULTURE, BEST_TIME, HOURS, FEES, NEARBY, PLAN, EMERGENCY, HOW_TO_REACH, GENERAL }

    static final Map<Intent, List<String>> KEYWORDS = Map.of(
            Intent.HISTORY, List.of("history", "built", "who made", "story", "origin", "इतिहास", "किसने", "बनवाया", "कहानी"),
            Intent.CULTURE, List.of("culture", "significance", "festival", "ritual", "importance", "संस्कृति", "महत्व", "त्योहार"),
            Intent.BEST_TIME, List.of("best time", "when to visit", "season", "weather", "month", "सबसे अच्छा समय", "कब जाएं", "मौसम"),
            Intent.HOURS, List.of("open", "opening", "hours", "close", "closed", "timing", "खुल", "बंद", "समय"),
            Intent.FEES, List.of("ticket", "fee", "price", "cost", "entry", "charge", "टिकट", "शुल्क", "कीमत", "प्रवेश"),
            Intent.NEARBY, List.of("near", "nearby", "around", "close to", "पास", "आसपास"),
            Intent.PLAN, List.of("plan", "itinerary", "days", "trip", "योजना", "यात्रा", "दिन"),
            Intent.EMERGENCY, List.of("hospital", "emergency", "police", "pharmacy", "ambulance", "doctor", "अस्पताल", "आपातकाल", "पुलिस", "दवा"),
            Intent.HOW_TO_REACH, List.of("how to reach", "reach", "get there", "route", "directions", "कैसे पहुंचे", "पहुँचे", "रास्ता"));

    static Intent detectIntent(String text) {
        String t = text.toLowerCase(Locale.ROOT);
        // order matters: emergency first, specific facts before generic history
        for (Intent i : List.of(Intent.EMERGENCY, Intent.FEES, Intent.BEST_TIME, Intent.HOURS, Intent.HOW_TO_REACH,
                Intent.NEARBY, Intent.PLAN, Intent.CULTURE, Intent.HISTORY)) {
            if (KEYWORDS.get(i).stream().anyMatch(t::contains)) return i;
        }
        return Intent.GENERAL;
    }

    @Transactional(readOnly = true)
    public Reply answer(String message, String locale, List<Turn> history, String contextSlug) {
        boolean hi = "hi".equals(locale);
        List<Destination> all = destinations.findByPublishedTrue();
        List<Destination> matched = match(message, all);
        if (matched.isEmpty() && contextSlug != null) {
            all.stream().filter(d -> d.getSlug().equals(contextSlug)).findFirst().ifPresent(matched::add);
        }
        List<DestinationCard> cards = cards(matched.stream().limit(4).toList());

        if (llm.enabled()) {
            try {
                return new Reply(llmAnswer(message, hi, history, matched, all), "llm", cards, suggestions(hi));
            } catch (Exception e) {
                log.warn("AI assistant failed, using rule-based answer: {}", e.getMessage());
            }
        }
        return new Reply(ruleAnswer(message, hi, matched, all), "rules", cards, suggestions(hi));
    }

    static List<Destination> match(String message, List<Destination> all) {
        String t = message.toLowerCase(Locale.ROOT);
        Set<Destination> out = new LinkedHashSet<>();
        for (Destination d : all) {
            String name = d.getName().toLowerCase(Locale.ROOT);
            String shortName = name.replaceAll("\\s*\\(.*\\)", "").replace("the ", "");
            if (t.contains(shortName) || (d.getNameHi() != null && message.contains(d.getNameHi()))) out.add(d);
        }
        if (out.isEmpty()) {
            for (Destination d : all) if (t.contains(d.getCity().toLowerCase(Locale.ROOT))) out.add(d);
        }
        return new ArrayList<>(out);
    }

    private List<DestinationCard> cards(List<Destination> ds) {
        Map<String, RatingStats> r = destinationService.ratings(ds.stream().map(Destination::getId).toList());
        return ds.stream().map(d -> DestinationCard.of(d, r.getOrDefault(d.getId(), RatingStats.NONE), null)).toList();
    }

    private static List<String> suggestions(boolean hi) {
        return hi
                ? List.of("ताज महल का इतिहास बताइए", "वाराणसी घूमने का सबसे अच्छा समय?", "लखनऊ में क्या देखें?")
                : List.of("Tell me the history of the Taj Mahal", "Best time to visit Varanasi?", "What should I see in Lucknow?");
    }

    // ---------------- rule-based ----------------

    String ruleAnswer(String message, boolean hi, List<Destination> matched, List<Destination> all) {
        Intent intent = detectIntent(message);
        if (intent == Intent.EMERGENCY) {
            return hi
                    ? "आपातकाल में भारत का राष्ट्रीय आपातकालीन नंबर **112** डायल करें। नज़दीकी अस्पताल, फ़ार्मेसी और पुलिस स्टेशन देखने के लिए Tripzee के \"Hotels & Services\" पेज पर अपनी लोकेशन चुनें।"
                    : "In an emergency, dial **112** (India's national emergency number). To find the nearest hospitals, pharmacies or police stations, open Tripzee's \"Hotels & Services\" page and pick your location.";
        }
        if (matched.isEmpty()) {
            String cities = all.stream().map(Destination::getCity).distinct().limit(8).collect(Collectors.joining(", "));
            return hi
                    ? "मुझे आपके सवाल में कोई जगह नहीं मिली। आप इन शहरों के बारे में पूछ सकते हैं: " + cities + "। उदाहरण: \"सारनाथ का इतिहास\" या \"आगरा में क्या देखें\"।"
                    : "I couldn't spot a place in your question. I can help with destinations in: " + cities
                    + ". Try \"history of Sarnath\" or \"what to see in Agra\".";
        }
        boolean cityQuery = matched.size() > 1 && matched.stream().map(Destination::getCity).distinct().count() == 1
                && matched.stream().noneMatch(d -> message.toLowerCase(Locale.ROOT).contains(d.getName().toLowerCase(Locale.ROOT)));
        if (cityQuery || intent == Intent.PLAN) {
            String city = matched.get(0).getCity();
            String list = matched.stream().limit(6).map(d -> "• **" + name(d, hi) + "** — " + summary(d, hi)).collect(Collectors.joining("\n"));
            return (hi ? "**" + city + "** में देखने लायक जगहें:\n" : "Places to see in **" + city + "**:\n") + list
                    + (hi ? "\n\nदिन-वार योजना के लिए Trip Planner का उपयोग करें।" : "\n\nUse the Trip Planner for a day-by-day itinerary.");
        }
        Destination d = matched.get(0);
        String n = "**" + name(d, hi) + "**";
        String unverified = hi ? "अभी सत्यापित नहीं है" : "not verified yet";
        String official = d.getOfficialUrl() != null ? d.getOfficialUrl() : null;
        String check = official != null
                ? (hi ? " आधिकारिक स्रोत देखें: " : " Please check the official source: ") + official
                : (hi ? " कृपया यात्रा से पहले आधिकारिक स्रोत से पुष्टि करें।" : " Please confirm with an official source before you go.");
        String engNote = hi ? " _(विवरण अंग्रेज़ी में)_" : "";
        return switch (intent) {
            case HISTORY -> n + (hi ? " का इतिहास:" + engNote + "\n" : " — history:\n") + orElse(d.getHistory(), d.getDescription());
            case CULTURE -> n + (hi ? " का सांस्कृतिक महत्व:" + engNote + "\n" : " — cultural significance:\n") + orElse(d.getCulturalSignificance(), d.getDescription());
            case BEST_TIME -> n + (hi ? " घूमने का अच्छा समय: " : " — best time to visit: ")
                    + orElse(d.getBestTimeToVisit(), hi ? "जानकारी उपलब्ध नहीं" : "no guidance recorded yet") + ".";
            case HOURS -> n + (hi ? " के खुलने का समय: " : " — opening hours: ")
                    + (d.getOpeningHours() != null ? d.getOpeningHours() + (d.isFactsVerified() ? "" : " (" + unverified + ")") + "." : unverified + ".") + check;
            case FEES -> n + (hi ? " का प्रवेश शुल्क: " : " — entry fee: ")
                    + (d.getEntryFee() != null ? d.getEntryFee() + (d.isFactsVerified() ? "" : " (" + unverified + ")") + "." : unverified + ".")
                    + (d.getTicketUrl() != null ? (hi ? " टिकट: " : " Tickets: ") + d.getTicketUrl() : check);
            case NEARBY -> {
                var near = destinationService.near(d.getLat(), d.getLng(), 40, d.getId()).stream().limit(5)
                        .map(c -> "• " + (hi && c.nameHi() != null ? c.nameHi() : c.name()) + " (" + c.distanceKm() + " km)").collect(Collectors.joining("\n"));
                yield near.isEmpty() ? n + (hi ? " के पास अभी कोई अन्य क्यूरेटेड जगह नहीं है।" : " has no other curated places nearby yet.")
                        : (hi ? n + " के पास:\n" : "Near " + n + ":\n") + near;
            }
            case HOW_TO_REACH -> n + (hi ? " " + d.getCity() + " में है। मानचित्र पर \"Directions\" से अपनी लोकेशन से रास्ता, दूरी और समय देखें।"
                    : " is in " + d.getCity() + ". Open it on the Map and use \"Directions\" for the route, distance and travel time from your location.");
            default -> n + " — " + summary(d, hi) + "\n\n" + (hi ? "आप इतिहास, घूमने का समय, आसपास की जगहें या खुलने का समय पूछ सकते हैं।"
                    : "Ask me about its history, best time to visit, nearby places or opening hours.");
        };
    }

    private static String name(Destination d, boolean hi) {
        return hi && d.getNameHi() != null ? d.getNameHi() : d.getName();
    }

    private static String summary(Destination d, boolean hi) {
        return hi && d.getSummaryHi() != null ? d.getSummaryHi() : d.getSummary();
    }

    private static String orElse(String v, String fallback) {
        return v != null && !v.isBlank() ? v : fallback;
    }

    // ---------------- LLM ----------------

    private String llmAnswer(String message, boolean hi, List<Turn> history, List<Destination> matched, List<Destination> all) {
        List<Destination> ctx = matched.isEmpty() ? List.of() : matched.stream().limit(4).toList();
        String facts = ctx.stream().map(d -> String.format(Locale.ROOT,
                "### %s (%s)\nSummary: %s\nHistory: %s\nCultural significance: %s\nBest time: %s\nOpening hours: %s\nEntry fee: %s\nFacts verified: %s\nOfficial site: %s",
                d.getName(), d.getCity(), d.getSummary(), orElse(d.getHistory(), "n/a"), orElse(d.getCulturalSignificance(), "n/a"),
                orElse(d.getBestTimeToVisit(), "n/a"), orElse(d.getOpeningHours(), "NOT VERIFIED"), orElse(d.getEntryFee(), "NOT VERIFIED"),
                d.isFactsVerified(), orElse(d.getOfficialUrl(), "n/a"))).collect(Collectors.joining("\n\n"));
        String cities = all.stream().map(Destination::getCity).distinct().collect(Collectors.joining(", "));
        String system = "You are Tripzee's friendly travel assistant for India (currently focused on Uttar Pradesh: " + cities + "). "
                + "Answer in " + (hi ? "Hindi (Devanagari script)" : "English") + ", concisely (under 180 words), using markdown bold sparingly. "
                + "Never state ticket prices, opening hours, phone numbers or booking details unless they appear in the facts below "
                + "AND are marked verified; otherwise say they are not verified and suggest checking the official source. "
                + "For emergencies always mention India's emergency number 112. If you are unsure, say so.\n\nFacts:\n"
                + (facts.isEmpty() ? "(no specific destination matched)" : facts);
        List<LlmClient.Message> msgs = new ArrayList<>();
        msgs.add(new LlmClient.Message("system", system));
        if (history != null) {
            history.stream().skip(Math.max(0, history.size() - 6))
                    .filter(t -> ("user".equals(t.role()) || "assistant".equals(t.role())) && t.content() != null)
                    .forEach(t -> msgs.add(new LlmClient.Message(t.role(), t.content().length() > 1500 ? t.content().substring(0, 1500) : t.content())));
        }
        msgs.add(new LlmClient.Message("user", message));
        return llm.chat(msgs, false);
    }
}
