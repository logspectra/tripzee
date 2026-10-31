package com.tripzee.assistant;

import static org.assertj.core.api.Assertions.assertThat;

import com.tripzee.assistant.AssistantService.Intent;
import org.junit.jupiter.api.Test;

class AssistantIntentTest {
    @Test
    void detectsEnglishAndHindiIntents() {
        assertThat(AssistantService.detectIntent("Tell me the history of Sarnath")).isEqualTo(Intent.HISTORY);
        assertThat(AssistantService.detectIntent("ताज महल का इतिहास")).isEqualTo(Intent.HISTORY);
        assertThat(AssistantService.detectIntent("What is the ticket price for Agra Fort?")).isEqualTo(Intent.FEES);
        assertThat(AssistantService.detectIntent("Best time to visit Varanasi?")).isEqualTo(Intent.BEST_TIME);
        assertThat(AssistantService.detectIntent("वाराणसी घूमने का सबसे अच्छा समय?")).isEqualTo(Intent.BEST_TIME);
        assertThat(AssistantService.detectIntent("When does it open?")).isEqualTo(Intent.HOURS);
        assertThat(AssistantService.detectIntent("nearest hospital please")).isEqualTo(Intent.EMERGENCY);
        assertThat(AssistantService.detectIntent("Hello")).isEqualTo(Intent.GENERAL);
    }
}
