// shipstation-api.js
const API_KEY = '3e015458d3d54b19a67577d8b8bb6f47';
const API_SECRET = 'd8b2d9dfb6ee4a56b37ce0b63fd4d6db';
const AUTH = btoa(`${API_KEY}:${API_SECRET}`);

// For debugging
console.log("shipstation-api.js loaded successfully");

// Cache settings
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const LOCAL_STORAGE_PREFIX = 'shipstation_cache_';

// Helper function to check if cache is valid
function isLocalCacheValid(cacheKey) {
    const cacheData = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${cacheKey}`);
    if (!cacheData) return false;
    
    try {
        const { timestamp } = JSON.parse(cacheData);
        return timestamp && (Date.now() - timestamp < CACHE_DURATION);
    } catch (error) {
        console.error("Error reading cache:", error);
        return false;
    }
}

// Helper function to get cached data
function getLocalCache(cacheKey) {
    try {
        const cacheData = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${cacheKey}`);
        if (!cacheData) return null;
        
        const { data } = JSON.parse(cacheData);
        return data;
    } catch (error) {
        console.error("Error reading cache data:", error);
        return null;
    }
}

// Helper function to set cache data
function setLocalCache(cacheKey, data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${cacheKey}`, JSON.stringify(cacheData));
        console.log(`Data cached with key: ${cacheKey}`);
    } catch (error) {
        console.error("Error caching data:", error);
    }
}

// Function to check if an order is from Amazon
function isAmazonOrder(shipment) {
    if (!shipment) return false;
    
    // Debug the shipment object to see all available fields
    console.log("Checking shipment:", shipment);
    
    // Check multiple fields for Amazon indicators
    // Check store name - this is usually the most reliable indicator
    const storeNameCheck = shipment.storeName && 
        (shipment.storeName.toLowerCase().includes('amazon') || 
         shipment.storeName.toLowerCase().includes('amz'));
        
    // Check order number - Amazon often has specific patterns
    const orderNumberCheck = shipment.orderNumber && 
        (shipment.orderNumber.toLowerCase().includes('amazon') || 
         shipment.orderNumber.toLowerCase().includes('amz') ||
         shipment.orderNumber.startsWith('TBA') || 
         shipment.orderNumber.startsWith('X00'));
        
    // Check customer name - sometimes Amazon fulfillment centers are listed
    const customerNameCheck = shipment.shipTo && 
        shipment.shipTo.name && 
        shipment.shipTo.name.toLowerCase().includes('amazon');
        
    // Check service code - sometimes specific to Amazon
    const serviceCheck = shipment.serviceCode && 
        shipment.serviceCode.toLowerCase().includes('amazon');
        
    // ShipStation sometimes stores marketplace info in the advancedOptions
    const advancedOptionsCheck = shipment.advancedOptions && 
        shipment.advancedOptions.storeId && 
        shipment.advancedOptions.storeId.toString().includes('amazon');
        
    // In shipstation, store ID 20 is often Amazon
    const storeIdCheck = shipment.storeId === 20 || 
        (shipment.advancedOptions && shipment.advancedOptions.storeId === 20);
    
    // Combined result
    const isAmazon = storeNameCheck || orderNumberCheck || customerNameCheck || 
                      serviceCheck || advancedOptionsCheck || storeIdCheck;
    
    // Log the result and the reasons if it's an Amazon order
    if (isAmazon) {
        console.log("✓ Identified Amazon shipment:", {
            orderNumber: shipment.orderNumber,
            storeNameMatch: storeNameCheck, 
            orderNumberMatch: orderNumberCheck,
            customerNameMatch: customerNameCheck,
            serviceMatch: serviceCheck,
            advancedOptionsMatch: advancedOptionsCheck,
            storeIdMatch: storeIdCheck
        });
    }
    
    return isAmazon;
}

async function fetchShipStationOrders(startDate, endDate) {
    console.log("Starting to fetch ShipStation orders...");
    console.log("Date range:", { startDate, endDate });
    
    // Create a cache key based on the date range
    const cacheKey = `orders_${startDate}_${endDate}`;
    
    // Check cache first
    if (isLocalCacheValid(cacheKey)) {
        console.log("Using cached orders data");
        const cachedOrders = getLocalCache(cacheKey);
        if (cachedOrders && cachedOrders.length > 0) {
            console.log(`Retrieved ${cachedOrders.length} orders from cache`);
            return cachedOrders;
        }
    }

    try {
        // Format dates for ShipStation API
        const formattedStartDate = new Date(startDate).toISOString();
        const formattedEndDate = new Date(endDate).toISOString();
        
        // Initialize variables for pagination
        let allOrders = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500; // Maximum page size allowed by ShipStation API
        
        // Loop through all pages until no more results
        while (hasMorePages) {
            const apiUrl = `https://ssapi.shipstation.com/orders?createDateStart=${formattedStartDate}&createDateEnd=${formattedEndDate}&pageSize=${pageSize}&page=${page}`;
            console.log(`Fetching orders page ${page}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${AUTH}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            console.log(`API response status for page ${page}: ${response.status}`);
            
            // If we get a CORS error or other error
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error: ${response.status} ${response.statusText}`);
                console.error("Error details:", errorText);
                
                // If this is a CORS error, show a more helpful message
                if (response.status === 0 || errorText.includes("CORS") || errorText.includes("cross-origin")) {
                    console.error("This appears to be a CORS error. ShipStation API doesn't allow direct browser requests.");
                    console.error("To fix this, you need to call the API from a server or use a server-side proxy.");
                    throw new Error("CORS error: Cannot access ShipStation API directly from the browser");
                }
                
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Received orders data for page ${page}, total count: ${data.orders?.length || 0}`);
            
            // Add orders from this page to our collection
            if (data.orders && data.orders.length > 0) {
                allOrders = [...allOrders, ...data.orders];
                
                // Check if we should fetch the next page
                if (data.orders.length < pageSize) {
                    hasMorePages = false;
                    console.log(`Page ${page} contained fewer than ${pageSize} orders, no more pages to fetch.`);
                } else {
                    page++;
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                hasMorePages = false;
                console.log(`Page ${page} contained no orders, no more pages to fetch.`);
            }
        }
        
        console.log(`Successfully fetched ${allOrders.length} orders across ${page} page(s)`);
        
        // Cache the results
        if (allOrders.length > 0) {
            setLocalCache(cacheKey, allOrders);
        }
        
        return allOrders;
    } catch (error) {
        console.error("Error fetching ShipStation orders:", error);
        // Log more details about the error
        if (error.message) console.error("Error message:", error.message);
        if (error.stack) console.error("Error stack:", error.stack);
        return [];
    }
}

async function fetchShipStationShipments(startDate, endDate) {
    console.log("Starting to fetch ShipStation shipments...");
    console.log("Date range:", { startDate, endDate });
    
    // Create a cache key based on the date range
    const cacheKey = `shipments_${startDate}_${endDate}`;
    
    // Check cache first
    if (isLocalCacheValid(cacheKey)) {
        console.log("Using cached shipments data");
        const cachedShipments = getLocalCache(cacheKey);
        if (cachedShipments && cachedShipments.length > 0) {
            console.log(`Retrieved ${cachedShipments.length} shipments from cache`);
            return cachedShipments;
        }
    }

    try {
        // Format dates for ShipStation API
        const formattedStartDate = new Date(startDate).toISOString();
        const formattedEndDate = new Date(endDate).toISOString();
        
        // Initialize variables for pagination
        let allShipments = [];
        let page = 1;
        let hasMorePages = true;
        const pageSize = 500; // Maximum page size allowed by ShipStation API
        
        // Loop through all pages until no more results
        while (hasMorePages) {
            const apiUrl = `https://ssapi.shipstation.com/shipments?shipDateStart=${formattedStartDate}&shipDateEnd=${formattedEndDate}&pageSize=${pageSize}&page=${page}`;
            console.log(`Fetching shipments page ${page}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${AUTH}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            console.log(`API response status for page ${page}: ${response.status}`);
            
            // If we get a CORS error or other error
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error: ${response.status} ${response.statusText}`);
                console.error("Error details:", errorText);
                
                // If this is a CORS error, show a more helpful message
                if (response.status === 0 || errorText.includes("CORS") || errorText.includes("cross-origin")) {
                    console.error("This appears to be a CORS error. ShipStation API doesn't allow direct browser requests.");
                    console.error("To fix this, you need to call the API from a server or use a server-side proxy.");
                    throw new Error("CORS error: Cannot access ShipStation API directly from the browser");
                }
                
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Received shipments data for page ${page}, total count: ${data.shipments?.length || 0}`);
            
            // Add shipments from this page to our collection
            if (data.shipments && data.shipments.length > 0) {
                allShipments = [...allShipments, ...data.shipments];
                
                // Check if we should fetch the next page
                if (data.shipments.length < pageSize) {
                    hasMorePages = false;
                    console.log(`Page ${page} contained fewer than ${pageSize} shipments, no more pages to fetch.`);
                } else {
                    page++;
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                hasMorePages = false;
                console.log(`Page ${page} contained no shipments, no more pages to fetch.`);
            }
        }
        
        console.log(`Successfully fetched ${allShipments.length} shipments across ${page} page(s)`);
        
        // Cache the results
        if (allShipments.length > 0) {
            setLocalCache(cacheKey, allShipments);
        }
        
        return allShipments;
    } catch (error) {
        console.error("Error fetching ShipStation shipments:", error);
        // Log more details about the error
        if (error.message) console.error("Error message:", error.message);
        if (error.stack) console.error("Error stack:", error.stack);
        return [];
    }
}

// Function to get label cost for an order
async function getLabelCost(orderNumber, shipments = null) {
    try {
        // If shipments are provided, use them instead of making an API call
        if (shipments) {
            const shipment = shipments.find(s => s.orderNumber === orderNumber);
            return shipment ? shipment.shipmentCost || 0 : 0;
        }

        // Fallback to individual API call if no shipments provided
        const apiUrl = `https://ssapi.shipstation.com/shipments?orderNumber=${orderNumber}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${AUTH}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.shipments && data.shipments.length > 0) {
            return data.shipments[0].shipmentCost || 0;
        }
        return 0;
    } catch (error) {
        console.error(`Error fetching label cost for order ${orderNumber}:`, error);
        return 0;
    }
}

// Export functions for use in other files
export { fetchShipStationOrders, fetchShipStationShipments, isAmazonOrder, getLabelCost };