package com.example.flowmerceproject.StorefrontCustomization.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "component_decorators")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComponentDecorator {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "decorator_id")
    private Long decoratorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "component_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private BaseComponent component;

    @Column(name = "priority", nullable = false)
    @Builder.Default
    private Integer priority = 0;

    @Column(name = "data", columnDefinition = "TEXT", nullable = false)
    @Builder.Default
    private String data = "{}";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
