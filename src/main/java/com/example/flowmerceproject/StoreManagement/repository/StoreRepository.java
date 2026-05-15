package com.example.flowmerceproject.StoreManagement.repository;

import com.example.flowmerceproject.StoreManagement.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StoreRepository extends JpaRepository<Store, Integer> {
    List<Store> findByMerchant_MerchantId(Integer merchantId);
    Optional<Store> findByStoreUrl(String storeUrl);
    boolean existsByStoreUrl(String storeUrl);
    List<Store> findByStatus(String status);
}