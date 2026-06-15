package com.example.flowmerceproject.PaymentManagement.repository;

import com.example.flowmerceproject.PaymentManagement.entity.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {
    List<WalletTransaction> findByWallet_WalletIdOrderByCreatedAtDesc(Integer walletId);
    Page<WalletTransaction> findByWallet_WalletIdOrderByCreatedAtDesc(Integer walletId, Pageable pageable);
}
