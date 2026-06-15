package com.example.flowmerceproject.StorefrontCustomization.repository;

import com.example.flowmerceproject.StorefrontCustomization.entity.ComponentDecorator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComponentDecoratorRepository extends JpaRepository<ComponentDecorator, Long> {

    List<ComponentDecorator> findByComponent_ComponentIdOrderByPriorityAsc(Long componentId);

    void deleteByComponent_ComponentId(Long componentId);
}
