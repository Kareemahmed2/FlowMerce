package com.example.flowmerceproject.StorefrontCustomization.repository;

import com.example.flowmerceproject.StorefrontCustomization.entity.StorefrontMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MediaRepository extends JpaRepository<StorefrontMedia, Long> {
    List<StorefrontMedia> findByStore_StoreIdOrderByUploadedAtDesc(Integer storeId);
}
