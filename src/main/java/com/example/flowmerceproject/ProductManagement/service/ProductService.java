package com.example.flowmerceproject.ProductManagement.service;

import com.example.flowmerceproject.InventoryMangement.entity.Inventory;
import com.example.flowmerceproject.InventoryMangement.repository.InventoryRepository;
import com.example.flowmerceproject.InventoryMangement.service.InventoryService;
import com.example.flowmerceproject.ProductManagement.dto.ProductDTOs;
import com.example.flowmerceproject.ProductManagement.entity.Category;
import com.example.flowmerceproject.ProductManagement.entity.Product;
import com.example.flowmerceproject.ProductManagement.entity.ProductMedia;
import com.example.flowmerceproject.ProductManagement.repository.CategoryRepository;
import com.example.flowmerceproject.ProductManagement.repository.ProductMediaRepository;
import com.example.flowmerceproject.ProductManagement.repository.ProductRepository;
import com.example.flowmerceproject.StoreManagement.entity.Store;
import com.example.flowmerceproject.StoreManagement.repository.StoreRepository;
import com.example.flowmerceproject.UserManagement.exception.ForbiddenException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import com.example.flowmerceproject.UserManagement.repository.MerchantRepository;
import com.example.flowmerceproject.UserManagement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductMediaRepository mediaRepository;
    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;

    // initialQuantity created automatic when u create product
    // update redis automatically
    @Transactional
    public ProductDTOs.ProductResponse createProduct(String email, Integer storeId,
                                                     ProductDTOs.CreateProductRequest request) {
        Store store = getStoreAndVerifyOwner(email, storeId);

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Category not found: " + request.getCategoryId()));
        }

        Product product = Product.builder()
                .store(store)
                .category(category)
                .name(request.getName())
                .description(request.getDescription())
                .basePrice(request.getBasePrice())
                .isActive(true)
                .rating(0.0)
                .build();

        productRepository.save(product);

        int initialQty = request.getInitialQuantity() != null
                ? request.getInitialQuantity() : 0;

        Inventory inventory = Inventory.builder()
                .productId(product.getProductId().longValue())
                .quantity(initialQty)
                .reservedQuantity(0)
                .lowStockThreshold(request.getLowStockThreshold() != null
                        ? request.getLowStockThreshold() : 10)
                .version(0)
                .build();

        inventoryRepository.save(inventory);

        // Cache in Redis immediately
        inventoryService.cacheStock(product.getProductId().longValue(), initialQty);

        log.info("Product created: id={}, name={}, initialQty={}",
                product.getProductId(), product.getName(), initialQty);

        return toResponse(product);
    }

    // GET ALL PRODUCTS — merchant sees all
    public List<ProductDTOs.ProductResponse> getStoreProducts(String email, Integer storeId) {
        getStoreAndVerifyOwner(email, storeId);
        return productRepository.findByStore_StoreId(storeId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // GET ACTIVE PRODUCTS — public (buyers)
    public List<ProductDTOs.ProductResponse> getActiveProducts(Integer storeId) {
        storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));
        return productRepository.findByStore_StoreIdAndIsActive(storeId, true)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // GET PRODUCT BY ID
    public ProductDTOs.ProductResponse getProductById(Integer productId) {
        return toResponse(findProductOrThrow(productId));
    }

    // UPDATE PRODUCT — name, description, price, category only
    // quantity updated by InventoryController not here
    @Transactional
    public ProductDTOs.ProductResponse updateProduct(String email, Integer storeId,
                                                     Integer productId,
                                                     ProductDTOs.UpdateProductRequest request) {
        getStoreAndVerifyOwner(email, storeId);
        Product product = findProductOrThrow(productId);

        if (request.getName() != null)        product.setName(request.getName());
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getBasePrice() != null)   product.setBasePrice(request.getBasePrice());
        if (request.getCategoryId() != null) {
            Category cat = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            product.setCategory(cat);
        }

        productRepository.save(product);
        return toResponse(product);
    }

    // TOGGLE ACTIVE
    @Transactional
    public ProductDTOs.ProductResponse toggleActive(String email, Integer storeId,
                                                    Integer productId) {
        getStoreAndVerifyOwner(email, storeId);
        Product product = findProductOrThrow(productId);
        product.setIsActive(!product.getIsActive());
        productRepository.save(product);
        return toResponse(product);
    }

    // DELETE PRODUCT , It will be automatic in inventory by ON DELETE CASCADE in db
    @Transactional
    public String deleteProduct(String email, Integer storeId, Integer productId) {
        getStoreAndVerifyOwner(email, storeId);
        Product product = findProductOrThrow(productId);
        productRepository.delete(product);
        log.info("Product deleted: id={} — Inventory auto-deleted via CASCADE", productId);
        return "Product deleted successfully.";
    }

    // SEARCH
    public List<ProductDTOs.ProductResponse> searchProducts(String keyword) {
        return productRepository.findByNameContainingIgnoreCase(keyword)
                .stream()
                .filter(Product::getIsActive)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ADD MEDIA
    @Transactional
    public ProductDTOs.MediaResponse addMedia(String email, Integer storeId,
                                              Integer productId,
                                              ProductDTOs.AddMediaRequest request) {
        getStoreAndVerifyOwner(email, storeId);
        Product product = findProductOrThrow(productId);

        ProductMedia media = ProductMedia.builder()
                .product(product)
                .mediaUrl(request.getMediaUrl())
                .mediaType(request.getMediaType())
                .altText(request.getAltText())
                .build();

        mediaRepository.save(media);
        return ProductDTOs.MediaResponse.builder()
                .mediaId(media.getMediaId())
                .mediaUrl(media.getMediaUrl())
                .mediaType(media.getMediaType())
                .altText(media.getAltText())
                .build();
    }

    // DELETE MEDIA
    @Transactional
    public String deleteMedia(String email, Integer storeId, Integer mediaId) {
        getStoreAndVerifyOwner(email, storeId);
        ProductMedia media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media not found: " + mediaId));
        mediaRepository.delete(media);
        return "Media deleted successfully.";
    }

    // HELPERS
    private Store getStoreAndVerifyOwner(String email, Integer storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("Store not found: " + storeId));
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        var merchant = merchantRepository.findByUser_UserId(user.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Merchant profile not found"));
        if (!store.getMerchant().getMerchantId().equals(merchant.getMerchantId())) {
            throw new ForbiddenException("You do not own this store.");
        }
        return store;
    }

    private Product findProductOrThrow(Integer productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + productId));
    }

    // toResponse — availableQuantity from Inventory (Redis → DB)
    public ProductDTOs.ProductResponse toResponse(Product p) {
        int availableQty = 0;
        try {
            availableQty = inventoryService.getAvailableQuantity(
                    p.getProductId().longValue());
        } catch (Exception ignored) {
            // if inventory record doesn't exist
        }

        List<ProductDTOs.MediaResponse> media = p.getMediaList() == null ? List.of() :
                p.getMediaList().stream()
                        .map(m -> ProductDTOs.MediaResponse.builder()
                                .mediaId(m.getMediaId())
                                .mediaUrl(m.getMediaUrl())
                                .mediaType(m.getMediaType())
                                .altText(m.getAltText())
                                .build())
                        .collect(Collectors.toList());

        return ProductDTOs.ProductResponse.builder()
                .productId(p.getProductId())
                .storeId(p.getStore().getStoreId())
                .storeName(p.getStore().getStoreName())
                .categoryId(p.getCategory() != null ? p.getCategory().getCategoryId() : null)
                .categoryName(p.getCategory() != null ? p.getCategory().getName() : null)
                .name(p.getName())
                .description(p.getDescription())
                .basePrice(p.getBasePrice())
                .availableQuantity(availableQty)  // from inventory
                .isActive(p.getIsActive())
                .rating(p.getRating())
                .media(media)
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}