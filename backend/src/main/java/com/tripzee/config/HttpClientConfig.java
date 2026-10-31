package com.tripzee.config;

import com.tripzee.common.AppProperties;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class HttpClientConfig {

    /** Shared client for outbound calls (OSM, Wikipedia, LLM). Finite timeouts on every call. */
    @Bean
    RestClient externalRestClient(AppProperties props) {
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(20));
        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", props.osm().userAgent())
                .build();
    }
}
