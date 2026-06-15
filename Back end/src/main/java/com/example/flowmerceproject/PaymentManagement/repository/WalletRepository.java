package com.example.flowmerceproject.PaymentManagement.repository;

import com.example.flowmerceproject.PaymentManagement.entity.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Integer> {
    Optional<Wallet> findByCustomer_CustomerId(Integer customerId);
    Optional<Wallet> findByMerchant_MerchantId(Integer merchantId);
}
