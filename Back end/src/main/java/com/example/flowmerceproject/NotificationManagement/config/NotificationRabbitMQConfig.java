package com.example.flowmerceproject.NotificationManagement.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class NotificationRabbitMQConfig {

    public static final String ORDER_EXCHANGE       = "flowmerce.order";
    public static final String ORDER_QUEUE          = "order.notifications";
    public static final String KEY_ORDER_STATUS     = "order.status.updated";
    public static final String KEY_ORDER_CANCELLED  = "order.cancelled";

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(ORDER_EXCHANGE, true, false);
    }

    @Bean
    public Queue orderNotificationQueue() {
        return QueueBuilder.durable(ORDER_QUEUE).build();
    }

    @Bean
    public Binding orderNotificationBinding(Queue orderNotificationQueue,
                                            TopicExchange orderExchange) {
        return BindingBuilder.bind(orderNotificationQueue)
                .to(orderExchange)
                .with("order.*");
    }
}
