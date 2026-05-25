package com.example.flowmerceproject.PaymentManagement.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentRabbitMQConfig {

    public static final String EXCHANGE         = "flowmerce.payment";
    public static final String QUEUE_NOTIFY     = "payment.notifications";
    public static final String QUEUE_WEBHOOK    = "payment.webhooks";

    public static final String KEY_INITIATED    = "payment.initiated";
    public static final String KEY_SUCCEEDED    = "payment.succeeded";
    public static final String KEY_FAILED       = "payment.failed";
    public static final String KEY_REFUNDED     = "payment.refunded";
    public static final String KEY_WALLET_DEBIT = "wallet.debited";
    public static final String KEY_WALLET_CREDIT= "wallet.credited";

    @Bean
    public TopicExchange paymentExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(QUEUE_NOTIFY).build();
    }

    @Bean
    public Queue webhookQueue() {
        return QueueBuilder.durable(QUEUE_WEBHOOK).build();
    }

    @Bean
    public Binding bindNotifyInitiated(Queue notificationQueue, TopicExchange paymentExchange) {
        return BindingBuilder.bind(notificationQueue).to(paymentExchange).with("payment.*");
    }

    @Bean
    public Binding bindNotifyWallet(Queue notificationQueue, TopicExchange paymentExchange) {
        return BindingBuilder.bind(notificationQueue).to(paymentExchange).with("wallet.*");
    }

    @Bean
    public Binding bindWebhook(Queue webhookQueue, TopicExchange paymentExchange) {
        return BindingBuilder.bind(webhookQueue).to(paymentExchange).with("payment.webhook.#");
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}
