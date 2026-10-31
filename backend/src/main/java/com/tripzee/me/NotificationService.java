package com.tripzee.me;

import com.tripzee.domain.Notification;
import com.tripzee.repo.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository repo;

    public void notify(String userId, String type, String message, String link) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setMessage(message.length() > 500 ? message.substring(0, 500) : message);
        n.setLink(link);
        repo.save(n);
    }
}
