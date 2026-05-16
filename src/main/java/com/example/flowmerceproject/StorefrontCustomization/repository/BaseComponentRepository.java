package com.example.flowmerceproject.StorefrontCustomization.repository;

import com.example.flowmerceproject.StorefrontCustomization.entity.BaseComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BaseComponentRepository extends JpaRepository<BaseComponent, Long> {

    List<BaseComponent> findByPage_PageIdOrderBySortOrderAsc(Long pageId);

    /**
     * Returns the next available sortOrder for a page:
     * current MAX + 1, or 0 when the page has no components yet.
     */
    @Query("SELECT COALESCE(MAX(c.sortOrder), -1) + 1 " +
           "FROM BaseComponent c " +
           "WHERE c.page.pageId = :pageId")
    Integer nextSortOrderForPage(@Param("pageId") Long pageId);
}
