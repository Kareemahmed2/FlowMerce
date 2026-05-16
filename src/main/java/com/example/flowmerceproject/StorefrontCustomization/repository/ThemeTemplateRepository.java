package com.example.flowmerceproject.StorefrontCustomization.repository;

import com.example.flowmerceproject.StorefrontCustomization.entity.ThemeTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ThemeTemplateRepository extends JpaRepository<ThemeTemplate, Long> {

    Optional<ThemeTemplate> findByStorefront_TemplateId(Long templateId);
}
