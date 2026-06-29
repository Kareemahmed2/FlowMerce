package com.example.flowmerceproject.IntegrationManagement.repository;

import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StoreIntegrationRepository extends JpaRepository<StoreIntegration, Integer> {

    Optional<StoreIntegration> findByStore_StoreIdAndProvider(
            Integer storeId, StoreIntegration.Provider provider);

    List<StoreIntegration> findByStore_StoreId(Integer storeId);
}
