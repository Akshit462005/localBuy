/**
 * Enhanced Order Status Manager
 * Provides real-time order tracking and status updates
 */

class OrderStatusManager {
    constructor() {
        this.orders = new Map();
        this.autoRefreshInterval = 30000; // 30 seconds
        this.refreshTimer = null;
        
        console.log('📦 Order Status Manager initialized');
        this.init();
    }

    /**
     * Initialize order status management
     */
    init() {
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    /**
     * Setup event listeners for order interactions
     */
    setupEventListeners() {
        // Listen for order card clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.order-card')) {
                const orderId = e.target.closest('.order-card').dataset.orderId;
                if (orderId) {
                    this.showOrderDetails(orderId);
                }
            }
        });

        // Listen for status filter changes
        const orderFilter = document.getElementById('orderFilter');
        if (orderFilter) {
            orderFilter.addEventListener('change', () => {
                this.filterOrders(orderFilter.value);
            });
        }

        // Listen for search input
        const orderSearch = document.getElementById('orderSearch');
        if (orderSearch) {
            orderSearch.addEventListener('input', debounce(() => {
                this.searchOrders(orderSearch.value.trim());
            }, 300));
        }
    }

    /**
     * Fetch detailed order information
     */
    async getOrderDetails(orderId) {
        try {
            const response = await fetch(`/user/api/orders/${orderId}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.orders.set(orderId, data.order);
                    return data.order;
                }
            }
            
            throw new Error('Failed to fetch order details');
        } catch (error) {
            console.error('Error fetching order details:', error);
            return null;
        }
    }

    /**
     * Get order progress information
     */
    async getOrderProgress(orderId) {
        try {
            const response = await fetch(`/user/api/orders/${orderId}/progress`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.success ? data.progress : null;
            }
            
            return null;
        } catch (error) {
            console.error('Error fetching order progress:', error);
            return null;
        }
    }

    /**
     * Show detailed order modal
     */
    async showOrderDetails(orderId) {
        try {
            this.showLoadingModal();
            
            const [order, progress] = await Promise.all([
                this.getOrderDetails(orderId),
                this.getOrderProgress(orderId)
            ]);

            if (!order) {
                this.showErrorModal('Failed to load order details');
                return;
            }

            this.renderOrderModal(order, progress);
            
        } catch (error) {
            console.error('Error showing order details:', error);
            this.showErrorModal('Error loading order details');
        }
    }

    /**
     * Render order details modal
     */
    renderOrderModal(order, progress) {
        const modal = this.createOrderModal(order, progress);
        document.body.appendChild(modal);
        
        // Animate modal in
        setTimeout(() => modal.classList.add('show'), 10);
    }

    /**
     * Create order details modal
     */
    createOrderModal(order, progress) {
        const modal = document.createElement('div');
        modal.className = 'order-modal-overlay';
        modal.innerHTML = `
            <div class="order-modal">
                <div class="modal-header">
                    <h2><i class="fas fa-box"></i> Order #${order.id}</h2>
                    <button class="close-btn" onclick="this.closest('.order-modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-content">
                    <!-- Order Progress -->
                    <div class="order-progress-section">
                        <h3>Order Status</h3>
                        ${this.createProgressBar(progress)}
                        <div class="status-info">
                            <div class="current-status">
                                <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span>
                                <span class="status-date">${new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                            ${progress && !progress.isCancelled ? `
                                <div class="estimated-delivery">
                                    <i class="fas fa-truck"></i>
                                    <span>Estimated Delivery: ${new Date(progress.estimatedDelivery).toLocaleDateString()}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Order Items -->
                    <div class="order-items-section">
                        <h3>Items (${order.items.length})</h3>
                        <div class="order-items-list">
                            ${order.items.map(item => `
                                <div class="order-item">
                                    <div class="item-image">
                                        <img src="${item.image_url || '/images/placeholder-product.jpg'}" 
                                             alt="${item.name}" onerror="this.src='/images/placeholder-product.jpg'">
                                    </div>
                                    <div class="item-details">
                                        <h4>${item.name}</h4>
                                        <p class="shopkeeper">by ${item.shopkeeper_name}</p>
                                        <div class="item-pricing">
                                            <span class="quantity">Qty: ${item.quantity}</span>
                                            <span class="price">₹${parseFloat(item.price).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Order Summary -->
                    <div class="order-summary-section">
                        <h3>Order Summary</h3>
                        <div class="summary-details">
                            <div class="summary-row">
                                <span>Subtotal:</span>
                                <span>₹${parseFloat(order.total_amount).toLocaleString()}</span>
                            </div>
                            <div class="summary-row total">
                                <span>Total:</span>
                                <span>₹${parseFloat(order.total_amount).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Shipping Information -->
                    ${order.shipping_address ? `
                        <div class="shipping-info-section">
                            <h3>Shipping Information</h3>
                            <div class="shipping-details">
                                <p><i class="fas fa-map-marker-alt"></i> ${order.shipping_address}</p>
                                <p><i class="fas fa-city"></i> ${order.city}, ${order.postal_code}</p>
                                <p><i class="fas fa-phone"></i> ${order.phone}</p>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Status History -->
                    ${order.statusHistory && order.statusHistory.length > 0 ? `
                        <div class="status-history-section">
                            <h3>Status History</h3>
                            <div class="status-timeline">
                                ${order.statusHistory.map(history => `
                                    <div class="timeline-item">
                                        <div class="timeline-marker"></div>
                                        <div class="timeline-content">
                                            <div class="timeline-status">${history.new_status.toUpperCase()}</div>
                                            <div class="timeline-date">${new Date(history.created_at).toLocaleString()}</div>
                                            ${history.reason ? `<div class="timeline-reason">${history.reason}</div>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="modal-actions">
                    <button class="btn secondary" onclick="this.closest('.order-modal-overlay').remove()">
                        Close
                    </button>
                    ${order.status !== 'delivered' && order.status !== 'cancelled' ? `
                        <button class="btn primary" onclick="window.orderStatusManager.trackOrder('${order.id}')">
                            <i class="fas fa-truck"></i> Track Order
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        return modal;
    }

    /**
     * Create progress bar for order status
     */
    createProgressBar(progress) {
        if (!progress || progress.isCancelled) {
            return `<div class="progress-bar cancelled">
                <div class="progress-text">Order Cancelled</div>
            </div>`;
        }

        const steps = [
            { label: 'Order Placed', active: progress.currentStep >= 1 },
            { label: 'Processing', active: progress.currentStep >= 2 },
            { label: 'Shipped', active: progress.currentStep >= 3 },
            { label: 'Delivered', active: progress.currentStep >= 4 }
        ];

        return `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.percentage}%"></div>
                <div class="progress-steps">
                    ${steps.map((step, index) => `
                        <div class="progress-step ${step.active ? 'active' : ''}">
                            <div class="step-marker">
                                <i class="fas ${step.active ? 'fa-check' : 'fa-circle'}"></i>
                            </div>
                            <div class="step-label">${step.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Show loading modal
     */
    showLoadingModal() {
        const existingModal = document.querySelector('.order-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'order-modal-overlay show';
        modal.innerHTML = `
            <div class="order-modal loading">
                <div class="loading-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading order details...</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Show error modal
     */
    showErrorModal(message) {
        const existingModal = document.querySelector('.order-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'order-modal-overlay show';
        modal.innerHTML = `
            <div class="order-modal error">
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button class="btn primary" onclick="this.closest('.order-modal-overlay').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Track order (placeholder for tracking functionality)
     */
    trackOrder(orderId) {
        window.open(`/user/track-order/${orderId}`, '_blank');
    }

    /**
     * Filter orders by status
     */
    filterOrders(status) {
        const orderCards = document.querySelectorAll('.order-card');
        orderCards.forEach(card => {
            const orderStatus = card.dataset.status;
            if (status === 'all' || orderStatus === status) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    /**
     * Search orders
     */
    searchOrders(query) {
        const orderCards = document.querySelectorAll('.order-card');
        const searchQuery = query.toLowerCase();
        
        orderCards.forEach(card => {
            const orderText = card.textContent.toLowerCase();
            if (!query || orderText.includes(searchQuery)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    /**
     * Start auto-refresh for order statuses
     */
    startAutoRefresh() {
        this.refreshTimer = setInterval(() => {
            this.refreshOrderStatuses();
        }, this.autoRefreshInterval);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * Refresh order statuses
     */
    async refreshOrderStatuses() {
        const orderCards = document.querySelectorAll('.order-card');
        const updates = [];
        
        orderCards.forEach(card => {
            const orderId = card.dataset.orderId;
            if (orderId) {
                updates.push(this.checkOrderUpdate(orderId, card));
            }
        });

        await Promise.allSettled(updates);
    }

    /**
     * Check for order updates
     */
    async checkOrderUpdate(orderId, cardElement) {
        try {
            const progress = await this.getOrderProgress(orderId);
            if (progress && cardElement) {
                const currentStatus = cardElement.dataset.status;
                const newStatus = progress.currentLabel.toLowerCase().replace(' ', '');
                
                if (currentStatus !== newStatus) {
                    this.updateOrderCard(cardElement, progress);
                }
            }
        } catch (error) {
            console.error(`Error checking updates for order ${orderId}:`, error);
        }
    }

    /**
     * Update order card with new status
     */
    updateOrderCard(cardElement, progress) {
        const statusBadge = cardElement.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = progress.currentLabel.toUpperCase();
            statusBadge.className = `status-badge status-${progress.currentLabel.toLowerCase()}`;
        }

        cardElement.dataset.status = progress.currentLabel.toLowerCase();
        
        // Show notification
        this.showStatusUpdateNotification(cardElement.dataset.orderId, progress.currentLabel);
    }

    /**
     * Show status update notification
     */
    showStatusUpdateNotification(orderId, newStatus) {
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.innerHTML = `
            <i class="fas fa-bell"></i>
            <span>Order #${orderId} status updated to: ${newStatus}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

// Utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize order status manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.orderStatusManager) {
        window.orderStatusManager = new OrderStatusManager();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrderStatusManager;
}