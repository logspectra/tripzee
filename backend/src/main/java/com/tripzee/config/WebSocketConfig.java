package com.tripzee.config;

import com.tripzee.auth.AppUser;
import com.tripzee.auth.CurrentUser;
import com.tripzee.common.AppProperties;
import com.tripzee.room.RoomService;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP over WebSocket at /ws. The HTTP handshake is authenticated by the session cookie
 * (Spring Security), origins are allow-listed, and every SUBSCRIBE is checked for room membership.
 * Clients never SEND through the socket — writes go through the REST API.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private static final Pattern ROOM_TOPIC = Pattern.compile("^/topic/rooms/([A-Za-z0-9-]{1,36})$");

    private final AppProperties props;
    private final ObjectProvider<RoomService> rooms; // provider breaks the RoomService → broker → config cycle

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOrigins(props.allowedOrigins().toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor acc = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (acc == null || acc.getCommand() == null) return message;
                AppUser user = CurrentUser.fromPrincipal(acc.getUser());
                switch (acc.getCommand()) {
                    case CONNECT -> {
                        if (user == null) throw new MessagingException("Not signed in");
                    }
                    case SUBSCRIBE -> {
                        Matcher m = ROOM_TOPIC.matcher(acc.getDestination() == null ? "" : acc.getDestination());
                        if (user == null || !m.matches() || !rooms.getObject().isMember(m.group(1), user.id())) {
                            throw new MessagingException("Not allowed to subscribe");
                        }
                    }
                    case SEND -> throw new MessagingException("Use the REST API to send");
                    default -> { }
                }
                return message;
            }
        });
    }
}
