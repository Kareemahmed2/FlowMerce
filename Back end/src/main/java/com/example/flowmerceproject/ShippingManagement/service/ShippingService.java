package com.example.flowmerceproject.ShippingManagement.service;

import com.example.flowmerceproject.IntegrationManagement.entity.StoreIntegration;
import com.example.flowmerceproject.IntegrationManagement.service.IntegrationCredentialResolver;
import com.example.flowmerceproject.OrderManagement.entity.Order;
import com.example.flowmerceproject.OrderManagement.repository.OrderRepository;
import com.example.flowmerceproject.ShippingManagement.entity.Shipment;
import com.example.flowmerceproject.ShippingManagement.gateway.ShippingCarrierAdapter;
import com.example.flowmerceproject.ShippingManagement.gateway.ShippingResult;
import com.example.flowmerceproject.ShippingManagement.repository.ShipmentRepository;
import com.example.flowmerceproject.UserManagement.exception.BadRequestException;
import com.example.flowmerceproject.UserManagement.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ShippingService {

    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;
    private final IntegrationCredentialResolver credentialResolver;
    private final List<ShippingCarrierAdapter> carriers;

    @Transactional
    public Shipment createShipmentForOrder(Integer orderId, String carrierCode) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        Shipment.Carrier carrier = parseCarrier(carrierCode);
        // Carrier and StoreIntegration.Provider names are kept in lockstep (DHL/ARAMEX/BOSTA)
        // so the carrier enum name doubles as the provider lookup key.
        StoreIntegration.Provider provider = StoreIntegration.Provider.valueOf(carrier.name());

        Map<String, String> credentials = credentialResolver
                .resolve(order.getStore().getStoreId(), provider)
                .orElseThrow(() -> new BadRequestException(
                        "Carrier " + carrierCode + " is not configured/enabled for this store. "
                                + "The merchant must add and enable it in Settings → Integrations."));

        ShippingCarrierAdapter adapter = carriers.stream()
                .filter(a -> a.supports(carrierCode))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Unsupported carrier: " + carrierCode));

        ShippingResult result = adapter.createShipment(order, credentials);

        Shipment shipment = Shipment.builder()
                .order(order)
                .carrier(carrier)
                .trackingNumber(result.getTrackingNumber())
                .status(result.getStatus() != null ? result.getStatus() : Shipment.ShipmentStatus.FAILED)
                .labelUrl(result.getLabelUrl())
                .carrierResponse(result.getCarrierResponse())
                .failureReason(result.getFailureReason())
                .build();

        return shipmentRepository.save(shipment);
    }

    private Shipment.Carrier parseCarrier(String carrierCode) {
        try {
            return Shipment.Carrier.valueOf(carrierCode.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unsupported carrier: " + carrierCode);
        }
    }
}
