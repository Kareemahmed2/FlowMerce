package com.example.flowmerceproject.StoreManagement.repository;

import com.example.flowmerceproject.StoreManagement.entity.StoreSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StoreSettingsRepository extends JpaRepository<StoreSettings, Integer> {
    Optional<StoreSettings> findByStore_StoreId(Integer storeId);
}