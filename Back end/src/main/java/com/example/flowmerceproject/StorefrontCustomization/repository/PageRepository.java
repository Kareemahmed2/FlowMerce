package com.example.flowmerceproject.StorefrontCustomization.repository;

import com.example.flowmerceproject.StorefrontCustomization.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PageRepository extends JpaRepository<Page, Long> {

    List<Page> findByStorefrontTemplate_TemplateIdOrderByNavOrderAsc(Long templateId);

    Optional<Page> findByStorefrontTemplate_TemplateIdAndSlug(Long templateId, String slug);

    boolean existsByStorefrontTemplate_TemplateIdAndSlug(Long templateId, String slug);

    /** Used to auto-compute the next navOrder when creating a page without an explicit one. */
    int countByStorefrontTemplate_TemplateId(Long templateId);
}
