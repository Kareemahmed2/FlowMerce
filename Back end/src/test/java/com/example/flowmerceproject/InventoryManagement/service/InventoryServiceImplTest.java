package com.example.flowmerceproject.InventoryManagement.service;

import com.example.flowmerceproject.InventoryManagement.entity.Inventory;
import com.example.flowmerceproject.InventoryManagement.entity.InventoryTransaction;
import com.example.flowmerceproject.InventoryManagement.event.StockChangedEvent;
import com.example.flowmerceproject.InventoryManagement.repository.InventoryRepository;
import com.example.flowmerceproject.InventoryManagement.repository.InventoryTransactionRepository;
import com.example.flowmerceproject.InventoryManagement.strategy.InventoryStrategy;
import com.example.flowmerceproject.InventoryManagement.strategy.InventoryStrategyFactory;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.StoreMangement.entity.Store;
import com.example.flowmerceproject.UserManagement.entity.Merchant;
import com.example.flowmerceproject.UserManagement.entity.User;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("InventoryServiceImpl Unit Tests")
class InventoryServiceImplTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private InventoryTransactionRepository transactionRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private InventoryStrategyFactory strategyFactory;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private UserRepository userRepository;
    @Mock private MerchantRepository merchantRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private InventoryStrategy normalStrategy;
    @Mock private InventoryStrategy reservedStrategy;

    @InjectMocks
    private InventoryServiceImpl inventoryService;

    private Inventory inventory;
    private Product product;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        User merchantUser = User.builder().userId(1).email("merchant@test.com").build();
        Merchant merchant = Merchant.builder().merchantId(1).user(merchantUser).build();
        Store store = Store.builder().storeId(1).storeName("Store").merchant(merchant).build();
        product = Product.builder().productId(1).name("Product").store(store).build();

        inventory = Inventory.builder()
                .inventoryId(1L)
                .productId(1)
                .storeId(1)
                .quantity(10)
                .reservedQuantity(0)
                .lowStockThreshold(5)
                .build();
    }

    // ── U-INV-01: adjustStock logs transaction ────────────────────────────────

    @Test
    @DisplayName("U-INV-01: adjustStock - updates stock and logs transaction")
    void adjustStock_validQuantity_updatesStockAndLogsTransaction() {
        when(inventoryRepository.findByProductId(1)).thenReturn(Optional.of(inventory));
        when(strategyFactory.getStrategy("NORMAL")).thenReturn(normalStrategy);
        when(inventoryRepository.save(any())).thenReturn(inventory);
        doAnswer(inv -> {
            inventory.setQuantity(inventory.getQuantity() + 5);
            return null;
        }).when(normalStrategy).updateStock(any(), eq(5));

        inventoryService.adjustStock(1L, 5, "NORMAL");

        verify(inventoryRepository).save(inventory);
        verify(transactionRepository).save(any(InventoryTransaction.class));
        verify(eventPublisher).publishEvent(any(StockChangedEvent.class));
    }

    // ── U-INV-02: adjustStock - OptimisticLock conflict throws BadRequest ─────

    @Test
    @DisplayName("U-INV-02: adjustStock - optimistic lock throws BadRequestException")
    void adjustStock_optimisticLockConflict_throwsBadRequestException() {
        when(inventoryRepository.findByProductId(1)).thenReturn(Optional.of(inventory));
        when(strategyFactory.getStrategy("NORMAL")).thenReturn(normalStrategy);
        when(inventoryRepository.save(any())).thenThrow(OptimisticLockingFailureException.class);
        doNothing().when(normalStrategy).updateStock(any(), anyInt());

        assertThatThrownBy(() -> inventoryService.adjustStock(1L, 5, "NORMAL"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("conflict");
    }

    // ── U-INV-03: reserveStock - sufficient available ─────────────────────────

    @Test
    @DisplayName("U-INV-03: reserveStock - sufficient stock reserves successfully")
    void reserveStock_sufficientStock_returnsTrue() {
        inventory.setQuantity(10);
        inventory.setReservedQuantity(0);

        when(redisTemplate.hasKey("product:1:stock")).thenReturn(true);
        when(valueOps.decrement("product:1:stock", 3L)).thenReturn(7L);
        when(inventoryRepository.findByProductId(1)).thenReturn(Optional.of(inventory));
        when(strategyFactory.getStrategy("RESERVED")).thenReturn(reservedStrategy);
        doAnswer(inv -> {
            inventory.setReservedQuantity(inventory.getReservedQuantity() + 3);
            return null;
        }).when(reservedStrategy).updateStock(any(), eq(3));
        when(inventoryRepository.save(any())).thenReturn(inventory);

        boolean result = inventoryService.reserveStock(1L, 3);

        assertThat(result).isTrue();
        verify(inventoryRepository).save(inventory);
    }

    // ── U-INV-04: reserveStock - insufficient → restores Redis, returns false ─

    @Test
    @DisplayName("U-INV-04: reserveStock - insufficient stock returns false and restores Redis")
    void reserveStock_insufficientStock_returnsFalseAndRestoresRedis() {
        when(redisTemplate.hasKey("product:1:stock")).thenReturn(true);
        when(valueOps.decrement("product:1:stock", 20L)).thenReturn(-10L);

        boolean result = inventoryService.reserveStock(1L, 20);

        assertThat(result).isFalse();
        verify(valueOps).increment("product:1:stock", 20L);
    }

    // ── U-INV-05: releaseStock restores reservedQuantity ─────────────────────

    @Test
    @DisplayName("U-INV-05: releaseStock - decrements reservedQuantity and increments Redis")
    void releaseStock_existingReservation_restoresStock() {
        inventory.setReservedQuantity(5);

        when(inventoryRepository.findByProductId(1)).thenReturn(Optional.of(inventory));
        when(inventoryRepository.save(any())).thenReturn(inventory);

        inventoryService.releaseStock(1L, 3);

        assertThat(inventory.getReservedQuantity()).isEqualTo(2);
        verify(valueOps).increment("product:1:stock", 3L);
    }

    // ── U-INV-06: releaseStock - more than reserved throws BadRequest ─────────

    @Test
    @DisplayName("U-INV-06: releaseStock - releasing more than reserved throws BadRequestException")
    void releaseStock_moreThanReserved_throwsBadRequestException() {
        inventory.setReservedQuantity(2);

        when(inventoryRepository.findByProductId(1)).thenReturn(Optional.of(inventory));

        assertThatThrownBy(() -> inventoryService.releaseStock(1L, 5))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Cannot release more than reserved");
    }

    // ── U-INV-07: checkAvailability - sufficient returns true ─────────────────

    @Test
    @DisplayName("U-INV-07: checkAvailability - sufficient stock returns true")
    void checkAvailability_sufficientStock_returnsTrue() {
        when(redisTemplate.hasKey("product:1:stock")).thenReturn(true);
        when(valueOps.get("product:1:stock")).thenReturn("10");

        boolean result = inventoryService.checkAvailability(1L, 5);

        assertThat(result).isTrue();
    }

    // ── U-INV-08: checkAvailability - insufficient returns false ─────────────

    @Test
    @DisplayName("U-INV-08: checkAvailability - insufficient stock returns false")
    void checkAvailability_insufficientStock_returnsFalse() {
        when(redisTemplate.hasKey("product:1:stock")).thenReturn(true);
        when(valueOps.get("product:1:stock")).thenReturn("3");

        boolean result = inventoryService.checkAvailability(1L, 10);

        assertThat(result).isFalse();
    }

    // ── U-INV-09: Inventory not found throws ResourceNotFoundException ─────────

    @Test
    @DisplayName("U-INV-09: adjustStock - inventory not found throws ResourceNotFoundException")
    void adjustStock_inventoryNotFound_throwsResourceNotFoundException() {
        when(inventoryRepository.findByProductId(999)).thenReturn(Optional.empty());
        when(strategyFactory.getStrategy("NORMAL")).thenReturn(normalStrategy);

        assertThatThrownBy(() -> inventoryService.adjustStock(999L, 5, "NORMAL"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
