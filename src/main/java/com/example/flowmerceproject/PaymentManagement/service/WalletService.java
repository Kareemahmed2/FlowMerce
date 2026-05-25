package com.example.flowmerceproject.PaymentManagement.service;

import com.example.flowmerceproject.PaymentManagement.dto.PaymentDTOs;
import com.example.flowmerceproject.PaymentManagement.entity.Wallet;
import com.example.flowmerceproject.PaymentManagement.entity.WalletTransaction;
import com.example.flowmerceproject.PaymentManagement.entity.WalletTransaction.ReferenceType;
import com.example.flowmerceproject.PaymentManagement.entity.WalletTransaction.TransactionType;
import com.example.flowmerceproject.PaymentManagement.repository.WalletRepository;
import com.example.flowmerceproject.PaymentManagement.repository.WalletTransactionRepository;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.StoreMangement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.entity.Customer;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.CustomerRepository;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private static final BigDecimal SIMULATION_STARTING_BALANCE = new BigDecimal("100000.00");

    private final WalletRepository walletRepository;
    private final WalletTransactionRepository txRepository;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final MerchantRepository merchantRepository;
    private final StoreRepository storeRepository;

    // ── GET OR CREATE ─────────────────────────────────────────────────────────

    @Transactional
    public Wallet getOrCreateCustomerWallet(Customer customer) {
        return walletRepository.findByCustomer_CustomerId(customer.getCustomerId())
                .orElseGet(() -> {
                    Wallet w = Wallet.builder()
                            .ownerType(Wallet.OwnerType.CUSTOMER)
                            .customer(customer)
                            .balance(SIMULATION_STARTING_BALANCE)
                            .build();
                    w = walletRepository.save(w);
                    log.info("Created customer wallet: customerId={}, balance={}",
                            customer.getCustomerId(), SIMULATION_STARTING_BALANCE);
                    return w;
                });
    }

    @Transactional
    public Wallet getOrCreateMerchantWallet(Merchant merchant) {
        return walletRepository.findByMerchant_MerchantId(merchant.getMerchantId())
                .orElseGet(() -> {
                    Wallet w = Wallet.builder()
                            .ownerType(Wallet.OwnerType.MERCHANT)
                            .merchant(merchant)
                            .balance(BigDecimal.ZERO)
                            .build();
                    w = walletRepository.save(w);
                    log.info("Created merchant wallet: merchantId={}", merchant.getMerchantId());
                    return w;
                });
    }

    // ── DEBIT / CREDIT ────────────────────────────────────────────────────────

    @Transactional
    public Wallet debitCustomer(Customer customer, BigDecimal amount,
                                String description, Integer referenceId) {
        Wallet wallet = getOrCreateCustomerWallet(customer);
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new BadRequestException(
                    "Insufficient wallet balance. Available: " + wallet.getBalance()
                            + " EGP, Required: " + amount + " EGP");
        }
        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);
        recordTransaction(wallet, amount, TransactionType.DEBIT,
                ReferenceType.PAYMENT, referenceId, description);
        return wallet;
    }

    @Transactional
    public Wallet creditMerchant(Merchant merchant, BigDecimal amount,
                                 String description, Integer referenceId) {
        Wallet wallet = getOrCreateMerchantWallet(merchant);
        wallet.setBalance(wallet.getBalance().add(amount));
        walletRepository.save(wallet);
        recordTransaction(wallet, amount, TransactionType.CREDIT,
                ReferenceType.PAYMENT, referenceId, description);
        return wallet;
    }

    @Transactional
    public Wallet debitMerchant(Merchant merchant, BigDecimal amount,
                                String description, Integer referenceId) {
        Wallet wallet = getOrCreateMerchantWallet(merchant);
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new BadRequestException("Merchant wallet has insufficient balance for refund.");
        }
        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);
        recordTransaction(wallet, amount, TransactionType.DEBIT,
                ReferenceType.REFUND, referenceId, description);
        return wallet;
    }

    @Transactional
    public Wallet creditCustomer(Customer customer, BigDecimal amount,
                                 String description, Integer referenceId) {
        Wallet wallet = getOrCreateCustomerWallet(customer);
        wallet.setBalance(wallet.getBalance().add(amount));
        walletRepository.save(wallet);
        recordTransaction(wallet, amount, TransactionType.CREDIT,
                ReferenceType.REFUND, referenceId, description);
        return wallet;
    }

    // ── QUERY ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PaymentDTOs.WalletResponse getCustomerWallet(String email) {
        Customer customer = resolveCustomer(email);
        Wallet wallet = getOrCreateCustomerWallet(customer);
        return toResponse(wallet);
    }

    @Transactional(readOnly = true)
    public PaymentDTOs.WalletResponse getMerchantWallet(String email, Integer storeId) {
        Merchant merchant = resolveMerchantForStore(email, storeId);
        Wallet wallet = getOrCreateMerchantWallet(merchant);
        return toResponse(wallet);
    }

    @Transactional
    public PaymentDTOs.WalletResponse topUp(String email, BigDecimal amount) {
        Customer customer = resolveCustomer(email);
        Wallet wallet = getOrCreateCustomerWallet(customer);
        wallet.setBalance(wallet.getBalance().add(amount));
        walletRepository.save(wallet);
        recordTransaction(wallet, amount, TransactionType.CREDIT,
                ReferenceType.TOPUP, null, "Wallet top-up (simulation)");
        return toResponse(wallet);
    }

    @Transactional(readOnly = true)
    public List<PaymentDTOs.WalletTransactionResponse> getCustomerTransactions(String email) {
        Customer customer = resolveCustomer(email);
        Wallet wallet = getOrCreateCustomerWallet(customer);
        return txRepository.findByWallet_WalletIdOrderByCreatedAtDesc(wallet.getWalletId())
                .stream().map(this::toTxResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PaymentDTOs.WalletTransactionResponse> getMerchantTransactions(String email,
                                                                                Integer storeId) {
        Merchant merchant = resolveMerchantForStore(email, storeId);
        Wallet wallet = getOrCreateMerchantWallet(merchant);
        return txRepository.findByWallet_WalletIdOrderByCreatedAtDesc(wallet.getWalletId())
                .stream().map(this::toTxResponse).collect(Collectors.toList());
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    private void recordTransaction(Wallet wallet, BigDecimal amount,
                                   TransactionType type, ReferenceType refType,
                                   Integer referenceId, String description) {
        txRepository.save(WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(type)
                .referenceType(refType)
                .referenceId(referenceId)
                .balanceAfter(wallet.getBalance())
                .description(description)
                .build());
    }

    private Customer resolveCustomer(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return customerRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new BadRequestException("Only customers can access wallets."));
    }

    private Merchant resolveMerchantForStore(String email, Integer storeId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Merchant merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Merchant profile not found"));
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));
        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new BadRequestException("You do not own this store.");
        }
        return merchant;
    }

    private PaymentDTOs.WalletResponse toResponse(Wallet w) {
        return PaymentDTOs.WalletResponse.builder()
                .walletId(w.getWalletId())
                .ownerType(w.getOwnerType())
                .balance(w.getBalance())
                .currency(w.getCurrency())
                .isActive(w.getIsActive())
                .createdAt(w.getCreatedAt())
                .build();
    }

    private PaymentDTOs.WalletTransactionResponse toTxResponse(WalletTransaction tx) {
        return PaymentDTOs.WalletTransactionResponse.builder()
                .transactionId(tx.getTransactionId())
                .amount(tx.getAmount())
                .type(tx.getType())
                .referenceType(tx.getReferenceType())
                .referenceId(tx.getReferenceId())
                .balanceAfter(tx.getBalanceAfter())
                .description(tx.getDescription())
                .createdAt(tx.getCreatedAt())
                .build();
    }
}
