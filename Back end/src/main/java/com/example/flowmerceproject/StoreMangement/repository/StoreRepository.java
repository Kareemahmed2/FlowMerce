package com.example.flowmerceproject.StoreMangement.repository;

import com.example.flowmerceproject.StoreMangement.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StoreRepository extends JpaRepository<Store, Integer> {

    List<Store> findByMerchant_MerchantId(Integer merchantId);
    int countByMerchant_MerchantId(Integer merchantId);

    @Query("SELECT s FROM Store s JOIN FETCH s.merchant m WHERE m.merchantId = :merchantId")
    List<Store> findByMerchantIdWithMerchant(@Param("merchantId") Integer merchantId);

    Optional<Store> findByStoreUrl(String storeUrl);
    boolean existsByStoreUrl(String storeUrl);
    List<Store> findByStatus(String status);
}
