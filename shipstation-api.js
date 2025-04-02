// ShipStation API credentials and configuration
const API_KEY = '3e015458d3d54b19a67577d8b8bb6f47';  // Your actual key from earlier messages
const API_SECRET = 'd8b2d9dfb6ee4a56b37ce0b63fd4d6db';  // Your actual secret from earlier messages
const AUTH = btoa(`${API_KEY}:${API_SECRET}`);

// Basic ShipStation API functions
async function fetchShipStationOrders(startDate, endDate) {
    console.log("Fetching ShipStation orders...");
    
    try {
        // Format dates for ShipStation API
        const formattedStartDate = new Date(startDate).toISOString();
        const formattedEndDate = new Date(endDate).toISOString();
        
        let allOrders = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500; // ShipStation's maximum page size
        
        while (hasMorePages) {
            const apiUrl = `https://ssapi.shipstation.com/orders?createDateStart=${formattedStartDate}&createDateEnd=${formattedEndDate}&pageSize=${pageSize}&page=${page}`;
            
            console.log(`Fetching page ${page}...`);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${AUTH}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText,
                    page: page
                });
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.orders && data.orders.length > 0) {
                allOrders = [...allOrders, ...data.orders];
                console.log(`Retrieved ${data.orders.length} orders from page ${page}. Total orders so far: ${allOrders.length}`);
                
                // Check if we need to fetch more pages
                if (data.orders.length < pageSize) {
                    hasMorePages = false;
                } else {
                    page++;
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                hasMorePages = false;
            }
        }

        console.log('Total orders retrieved:', {
            orderCount: allOrders.length,
            totalPages: page,
            dateRange: `${formattedStartDate} to ${formattedEndDate}`
        });
        
        return allOrders;
        
    } catch (error) {
        console.error("Error fetching ShipStation orders:", {
            error: error.message,
            stack: error.stack
        });
        return [];
    }
}

async function fetchShipStationShipments(startDate, endDate) {
    console.log("Fetching ShipStation shipments...");
    try {
        // For now, return empty array since we're not actually connecting to ShipStation
        return [];
    } catch (error) {
        console.error("Error fetching ShipStation shipments:", error);
        return [];
    }
}

function isAmazonOrder(order) {
    // Implementation for checking if an order is from Amazon
    return false;
}

async function getLabelCost(orderNumber) {
    // Implementation for getting label cost
    return 0;
}

// Function to analyze orders and get sales by SKU for a given date range
async function getProductSalesBySKU(startDate, endDate) {
    console.log("Analyzing product sales by SKU...");
    console.log("Date range for sales:", {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        daysInRange: Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24))
    });
    
    try {
        const orders = await fetchShipStationOrders(startDate, endDate);
        console.log(`Processing ${orders.length} total orders for sales analysis`);
        
        // Track sales by store for debugging
        const storeStats = {};
        const salesBySKU = {};
        
        orders.forEach((order, index) => {
            // Track store statistics
            const storeName = order.storeName || 'Unknown Store';
            if (!storeStats[storeName]) {
                storeStats[storeName] = {
                    orderCount: 0,
                    itemCount: 0
                };
            }
            storeStats[storeName].orderCount++;
            
            if (order.items && Array.isArray(order.items)) {
                storeStats[storeName].itemCount += order.items.length;
                
                order.items.forEach(item => {
                    const sku = item.sku;
                    const quantity = item.quantity || 0;
                    
                    if (!salesBySKU[sku]) {
                        salesBySKU[sku] = {
                            totalQuantity: 0,
                            orderCount: 0,
                            byStore: {}
                        };
                    }
                    
                    // Track total sales
                    salesBySKU[sku].totalQuantity += quantity;
                    salesBySKU[sku].orderCount++;
                    
                    // Track sales by store
                    if (!salesBySKU[sku].byStore[storeName]) {
                        salesBySKU[sku].byStore[storeName] = 0;
                    }
                    salesBySKU[sku].byStore[storeName] += quantity;
                });
            }
        });
        
        // Log store statistics
        console.log('Sales by store:', storeStats);
        
        // Log detailed info for specific SKU
        if (salesBySKU['SM-3116']) {
            console.log('Detailed sales for SM-3116:', salesBySKU['SM-3116']);
        }
        
        return salesBySKU;
        
    } catch (error) {
        console.error("Error generating sales report:", error);
        return {};
    }
}

// Helper function to get the first day of the current month
function getFirstDayOfMonth() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Helper function to get today's date
function getCurrentDate() {
    return new Date();
}

// Function to get current month's sales
async function getCurrentMonthSales() {
    const startDate = getFirstDayOfMonth();
    const endDate = getCurrentDate();
    return await getProductSalesBySKU(startDate, endDate);
}

// Export all functions
export { 
    fetchShipStationOrders, 
    fetchShipStationShipments, 
    isAmazonOrder, 
    getLabelCost,
    getProductSalesBySKU,
    getCurrentMonthSales,
    getFirstDayOfMonth,
    getCurrentDate
}; 