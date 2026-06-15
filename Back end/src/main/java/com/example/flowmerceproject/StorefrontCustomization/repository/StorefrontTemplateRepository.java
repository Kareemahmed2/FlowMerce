package com.example.flowmerceproject.StorefrontCustomization.repository;

import com.example.flowmerceproject.StorefrontCustomization.entity.StorefrontTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StorefrontTemplateRepository extends JpaRepository<StorefrontTemplate, Long> {

    Optional<StorefrontTemplate> findByStore_StoreId(Integer storeId);

    boolean existsByStore_StoreId(Integer storeId);

    /** Fetches template + theme + store in one query to avoid N+1. */
    @Query("SELECT st FROM StorefrontTemplate st LEFT JOIN FETCH st.theme LEFT JOIN FETCH st.store " +
           "WHERE st.store.storeId = :storeId")
    Optional<StorefrontTemplate> findWithThemeByStoreId(@Param("storeId") Integer storeId);

    /** Public lookup — only returns PUBLISHED templates. Fetches theme + store eagerly. */
    @Query("SELECT st FROM StorefrontTemplate st LEFT JOIN FETCH st.theme LEFT JOIN FETCH st.store " +
           "WHERE st.store.storeUrl = :storeUrl AND st.status = 'PUBLISHED'")
    Optional<StorefrontTemplate> findPublishedByStoreUrl(@Param("storeUrl") String storeUrl);

    /** Public lookup by storeId — only returns PUBLISHED templates. */
    @Query("SELECT st FROM StorefrontTemplate st LEFT JOIN FETCH st.theme LEFT JOIN FETCH st.store " +
           "WHERE st.store.storeId = :storeId AND st.status = 'PUBLISHED'")
    Optional<StorefrontTemplate> findPublishedByStoreId(@Param("storeId") Integer storeId);
}
