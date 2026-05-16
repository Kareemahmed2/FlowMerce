package com.example.flowmerceproject.StorefrontCustomization.entity;

/**
 * DecoratorComponent is the interface for optional visual enhancements that can be
 * layered onto a {@link BaseComponent} without modifying the component itself —
 * the classic Decorator design pattern.
 *
 * Concrete implementations (e.g. border, shadow, animation) are not yet created.
 * Multiple decorators may be stacked on a single component; implementations must
 * expose a priority so the rendering layer can apply them in a deterministic order.
 */
public interface DecoratorComponent {

    /** Identifies the type of decoration (e.g. "BORDER", "SHADOW"). */
    String getDecoratorType();

    /** JSON string holding decorator-specific configuration. */
    String getProperties();

    /** Whether this decorator is currently applied during rendering. */
    boolean isActive();

    /** Stack order — lower value is applied outermost (first in CSS chain). */
    int getPriority();
}
